import { expect, test, type Page } from '@playwright/test';

/**
 * Критические пользовательские сценарии без авторизации: лендинг франшизы
 * не должен быть «чёрным экраном», карта отделений открывает виджет по пину,
 * 404 и локали отвечают корректно. Сценарии с бронью жили на демо-режиме
 * и удалены вместе с ним: вход теперь только через настоящий Ecash с SMS.
 */

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

  // Пины — наши узлы с data-testid, одинаковые у 2GIS и Yandex (pins.ts).
  const pin = page.getByTestId('map-pin').first();
  await expect(pin).toBeVisible({ timeout: 15_000 });
  await pin.scrollIntoViewIfNeeded();
  // Карта в headless непрерывно перерисовывается — обходим проверку
  // стабильности; результат клика проверяют ассерты виджета ниже.
  await pin.click({ force: true });

  const widget = page.getByRole('dialog');
  await expect(widget).toBeVisible();
  // В виджете — курсы покупки/продажи, бронь и маршрут. Кнопка «Списком» —
  // НЕ здесь: это переключатель вида всей страницы, он живёт над картой.
  await expect(widget.getByText(/покупка/i)).toBeVisible();
  await expect(widget.getByText(/продажа/i)).toBeVisible();
  await expect(widget.getByRole('button', { name: /забронировать/i })).toBeVisible();
  await expect(widget.getByRole('link', { name: /маршрут/i })).toBeVisible();

  // Esc закрывает.
  await page.keyboard.press('Escape');
  await expect(widget).toBeHidden();
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
