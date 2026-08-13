import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EcashError } from '../errors';

/**
 * Скрытое отделение должно быть скрыто ВЕЗДЕ, а не только в списке.
 *
 * История бага: фильтр (`HIDDEN_DEP_IDS` + записи без адреса) стоял только в
 * `depList()`. Список выглядел чистым, а служебные отделения дев-контура
 * оставались доступны в обход него: `/api/departments/40` отдавал DEVTEST,
 * `/api/rates?depId=34` — курсы «проверки лимитов», а ссылка
 * `/booking?depId=40` открывала бронь на отделение с адресом «test».
 * Проверено на живом стенде до правки.
 */

process.env.ECASH_API_BASE_URL = 'https://api-dev.quiq.kz';
process.env.ECASH_CLIENT_ID = 'test';
process.env.ECASH_CLIENT_SECRET = 'test';
process.env.SESSION_SECRET = Buffer.alloc(32, 7).toString('base64');
process.env.DATABASE_URL = 'postgres://t:t@localhost:5432/t';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.HIDDEN_DEP_IDS = '34,36,40';

const ecashFetch = vi.fn();

vi.mock('../http', () => ({ ecashFetch: (...a: unknown[]) => ecashFetch(...a) }));
vi.mock('../service-token', () => ({
  getServiceToken: () => Promise.resolve('svc'),
  invalidateServiceToken: () => {},
}));

const { depList, depInfo, assertVisibleDep } = await import('./departments');

/** Живой ответ дев-контура, сокращённый: настоящие, служебные и без адреса. */
const UPSTREAM = [
  { depId: 1, address: 'ул. Кабдолова, 1/4', code: 'Гранд Парк' },
  { depId: 10, address: 'ТЦ Сарыарка', code: 'Сарыарка' },
  { depId: 24, address: '', code: 'ТестТест' },
  { depId: 25, address: '   ', code: 'Тест' },
  { depId: 34, address: ' Для проверки лимитов', code: 'проверка лимитов' },
  { depId: 36, address: 'Проверка', code: 'Франшизы' },
  { depId: 40, address: 'test', code: 'DEVTEST' },
];

type CacheState = { entries: Map<string, unknown>; inflight: Map<string, unknown> };

beforeEach(() => {
  ecashFetch.mockReset();
  // кеш апстрима живёт в globalThis и переживает тесты — иначе первый же
  // depList() зафиксировал бы список на 5 минут и остальные проверки
  // сравнивали бы его с самим собой
  const c = (globalThis as unknown as { __ecashUpstreamCache?: CacheState }).__ecashUpstreamCache;
  c?.entries.clear();
  c?.inflight.clear();
});

describe('depList — что видит посетитель', () => {
  it('служебные и безадресные записи не попадают в список', async () => {
    ecashFetch.mockResolvedValue(UPSTREAM);
    const deps = await depList();
    expect(deps.map((d) => d.depId)).toEqual([1, 10]);
  });
});

describe('assertVisibleDep — тот же фильтр вне списка', () => {
  beforeEach(() => ecashFetch.mockResolvedValue(UPSTREAM));

  it.each([
    [24, 'без адреса'],
    [25, 'пробелы вместо адреса'],
    [34, 'HIDDEN_DEP_IDS'],
    [36, 'HIDDEN_DEP_IDS'],
    [40, 'HIDDEN_DEP_IDS'],
  ])('отделение %i (%s) — отказ', async (id) => {
    await expect(assertVisibleDep(id)).rejects.toBeInstanceOf(EcashError);
  });

  it('несуществующее отделение — тот же отказ, без подсказки об id', async () => {
    await expect(assertVisibleDep(9999)).rejects.toMatchObject({
      code: 'DEPARTMENT_NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('настоящие отделения проходят', async () => {
    await expect(assertVisibleDep(1)).resolves.toBeUndefined();
    await expect(assertVisibleDep(10)).resolves.toBeUndefined();
  });
});

describe('depInfo — карточка отделения', () => {
  it('скрытое отделение не отдаётся и НЕ идёт в апстрим за карточкой', async () => {
    ecashFetch.mockResolvedValue(UPSTREAM);
    await expect(depInfo(40)).rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' });
    // единственный вызов — список; за depInfo/40 в Ecash не ходили
    expect(ecashFetch.mock.calls.every(([path]) => String(path).includes('depListApp'))).toBe(true);
  });

  it('видимое отделение отдаётся как раньше', async () => {
    ecashFetch.mockImplementation((path: string) =>
      Promise.resolve(
        String(path).includes('depListApp')
          ? UPSTREAM
          : { depId: 10, address: 'ТЦ Сарыарка', code: 'Сарыарка' },
      ),
    );
    await expect(depInfo(10)).resolves.toMatchObject({ depId: 10 });
  });
});
