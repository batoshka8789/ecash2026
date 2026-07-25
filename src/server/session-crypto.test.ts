import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Раундтрип AES-GCM куки сессии. env.ts валидирует окружение при импорте —
 * задаём ключи до динамического импорта модуля.
 */

const KEY_A = Buffer.from(new Uint8Array(32).fill(7)).toString('base64');
const KEY_B = Buffer.from(new Uint8Array(32).fill(9)).toString('base64');

let crypto1: typeof import('./session-crypto');

beforeAll(async () => {
  process.env.ECASH_API_BASE_URL = 'https://api-dev.quiq.kz';
  process.env.ECASH_CLIENT_ID = 'test';
  process.env.ECASH_CLIENT_SECRET = 'test';
  process.env.SESSION_SECRET = KEY_A;
  process.env.SESSION_SECRET_PREVIOUS = KEY_B;
  process.env.DATABASE_URL = 'postgres://test';
  process.env.APP_ORIGIN = 'http://localhost:3000';
  crypto1 = await import('./session-crypto');
});

describe('session-crypto', () => {
  const payload = {
    accessToken: 'a'.repeat(300),
    refreshToken: 'r'.repeat(44),
    accessExpiresAt: 1784965917000,
    accountId: '9f8e7d6c-5b4a-3210-fedc-ba9876543210',
  };

  it('seal → unseal возвращает исходное', async () => {
    const sealed = await crypto1.seal(payload);
    expect(sealed.startsWith('v1.')).toBe(true);
    const out = await crypto1.unseal<typeof payload>(sealed);
    expect(out).toEqual(payload);
  });

  it('кука укладывается в лимит 4КБ с реальными размерами токенов', async () => {
    const sealed = await crypto1.seal(payload);
    expect(sealed.length).toBeLessThan(1500);
  });

  it('повреждённая кука → null, не исключение', async () => {
    const sealed = await crypto1.seal(payload);
    expect(await crypto1.unseal(sealed.slice(0, -4) + 'AAAA')).toBeNull();
    expect(await crypto1.unseal('мусор')).toBeNull();
    expect(await crypto1.unseal('v1.only-two')).toBeNull();
  });

  it('каждый seal даёт уникальный шифртекст (случайный IV)', async () => {
    const a = await crypto1.seal(payload);
    const b = await crypto1.seal(payload);
    expect(a).not.toBe(b);
  });
});
