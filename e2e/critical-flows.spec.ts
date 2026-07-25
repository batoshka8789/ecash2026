import { expect, test, type Page } from '@playwright/test';

/**
 * Критические пользовательские сценарии — три жалобы заказчика:
 * 1) лендинг франшизы не должен быть «чёрным экраном»;
 * 2) карта отделений: клик по пину показывает виджет с информацией;
 * 3) после отправки заявки есть полноценный послеоперационный экран.
 */

const DEMO_PHONE = '+77001112233';
const DEMO_PASSWORD = 'ecash2026';

async function login(page: Page) {
  const res = await page.request.post('/api/auth/login', {
    data: { login: DEMO_PHONE, password: DEMO_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

/** Демо-аккаунт общий — снимаем чужие активные заявки, иначе дубль (409). */
async function cancelActiveRequests(page: Page) {
  const res = await page.request.get('/api/requests?page=1&pageSize=50');
  if (!res.ok()) return;
  const { requests } = (await res.json()) as {
    requests: { requestId: number; status: number }[];
  };
  for (const r of requests) {
    if (r.status === 0 || r.status === 8) {
      await page.request.post(`/api/requests/${r.requestId}/cancel`, { data: {} });
    }
  }
}

/** Доля видимой площади строки героя внутри маски overflow-hidden. */
async function heroLineVisibility(page: Page): Promise<number> {
  return page
    .locator('h1 > span')
    .first()
    .evaluate((mask) => {
      const inner = mask.firstElementChild as HTMLElement | null;
      if (!inner) return 0;
      const m = mask.getBoundingClientRect();
      const i = inner.getBoundingClientRect();
      if (i.height === 0) return 0;
      const overlap = Math.min(m.bottom, i.bottom) - Math.max(m.top, i.top);
      return overlap / i.height;
    });
}

test('лендинг франшизы: строки героя не застревают спрятанными за маской', async ({ page }) => {
  await page.goto('/franchise');
  const h1 = page.locator('h1');
  await expect(h1).toContainText('Начните свой', { timeout: 10_000 });

  // Даём CSS-анимации отыграть (0.75s + задержки) и проверяем итог.
  await expect
    .poll(() => heroLineVisibility(page), { timeout: 5_000 })
    .toBeGreaterThan(0.9);

  const box = await h1.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(40);
});

test('лендинг с prefers-reduced-motion: контент виден сразу, без анимаций', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/franchise');
  await expect(page.locator('h1')).toContainText('Начните свой');
  // Без анимаций строки видимы сразу после готовности лейаута —
  // poll здесь ждёт только layout/шрифты, а не анимацию.
  await expect
    .poll(() => heroLineVisibility(page), { timeout: 3_000 })
    .toBeGreaterThan(0.9);
});

test('карта: клик по пину открывает виджет отделения с курсами и кнопкой брони', async ({
  page,
}) => {
  await page.goto('/locations');
  await page.getByRole('button', { name: /на карте/i }).click();

  // Ждём маркеры MapLibre.
  const pin = page.locator('.maplibregl-marker').first();
  await expect(pin).toBeVisible({ timeout: 15_000 });
  await pin.scrollIntoViewIfNeeded();
  // Карта в headless непрерывно перерисовывается — обходим проверку
  // стабильности; результат клика проверяют ассерты виджета ниже.
  await pin.click({ force: true });

  const widget = page.getByRole('dialog');
  await expect(widget).toBeVisible();
  // В виджете — адрес, часы работы и действия.
  await expect(widget.getByRole('button', { name: /забронировать/i })).toBeVisible();
  await expect(widget.getByRole('button', { name: /списком/i })).toBeVisible();

  // Esc закрывает.
  await page.keyboard.press('Escape');
  await expect(widget).toBeHidden();
});

test('бронь: полный цикл до послеоперационного экрана и отмены', async ({ page }) => {
  await login(page);
  await cancelActiveRequests(page);
  await page.goto('/booking');

  // Сумма уже с плейсхолдером; вводим свою.
  const amount = page.locator('input:not([readonly])').first();
  await amount.fill('100000');
  await page.getByRole('button', { name: /^забронировать$/i }).click();

  // Послеоперационный экран: карточка заявки со статусом «на рассмотрении».
  await page.waitForURL(/\/requests\/\d+/, { timeout: 15_000 });
  await expect(page.locator('h1')).toContainText(/отправлена|рассмотрении/i);

  // Блоки макета: валютная пара, адрес отделения, ваши данные.
  await expect(page.getByRole('heading', { name: /валютная пара/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /адрес отделения/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /ваши данные/i })).toBeVisible();

  // Мок-казначей отвечает ~8 с: ждём статус «Забронирована» + таймер.
  await expect(page.locator('h1')).toContainText(/забронировали/i, { timeout: 30_000 });
  await expect(page.getByRole('timer')).toBeVisible();

  // Отмена возвращает статус «Отменена»/«Снято с брони».
  await page.getByRole('button', { name: /отменить/i }).click();
  await expect(page.locator('h1')).toContainText(/снято|отмен/i, { timeout: 10_000 });
});

test('индивидуальный курс: запрос → предложение казначея → согласие', async ({ page }) => {
  await login(page);
  await cancelActiveRequests(page);
  await page.goto('/individual-rate');

  // Первый редактируемый textbox — сумма (readonly-поля результата пропускаем).
  const editable = page.locator('input:not([readonly])');
  await editable.first().fill('2000000');

  await page.getByRole('button', { name: /запросить|продолжить/i }).click();
  await page.waitForURL(/\/requests\/\d+/, { timeout: 15_000 });

  // Казначей согласует (мок ~8 с) → появляются кнопки решения клиента.
  await expect(page.getByRole('button', { name: /согласен/i })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: /согласен/i }).click();

  // После согласия — обычный процесс брони (статус 0 → 8).
  await expect(page.locator('h1')).toContainText(/забронировали|отправлена/i, {
    timeout: 30_000,
  });
});

test('404 и локали', async ({ page }) => {
  const res = await page.goto('/nonexistent-page');
  expect(res?.status()).toBe(404);
  await expect(page.locator('body')).not.toContainText('Application error');

  for (const path of ['/en/locations', '/kk/locations']) {
    const r = await page.goto(path);
    expect(r?.status()).toBe(200);
    // Ключи переводов не должны утекать в текст.
    const text = await page.getByRole('main').first().innerText();
    expect(text).not.toMatch(
      /\b(errors|flows|requests|locations|profile|auth|common|home|subscribe)\.[a-zA-Z][a-zA-Z.]+\b/,
    );
  }
});
