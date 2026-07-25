import { describe, expect, it } from 'vitest';
import { normalizeError } from './errors';

describe('normalizeError — обе формы ответа upstream', () => {
  it('доменная форма', () => {
    const e = normalizeError(409, {
      success: false,
      code: 409,
      error: 'REQUEST_ALREADY_EXISTS',
      message: 'Заявка уже существует',
      data: { requestId: 10432 },
    });
    expect(e.code).toBe('REQUEST_ALREADY_EXISTS');
    expect(e.httpStatus).toBe(409);
    expect(e.data).toEqual({ requestId: 10432 });
  });

  it('ASP.NET ProblemDetails с нормализацией имён полей', () => {
    const e = normalizeError(400, {
      errors: { Login: ['The Login field is required.'], Password: ['Required'] },
      status: 400,
      traceId: '00-abc-def-00',
    });
    expect(e.code).toBe('VALIDATION');
    expect(e.fields).toEqual(['login', 'password']);
    expect(e.traceId).toBe('00-abc-def-00');
  });

  it('пустые 401/403 от auth-мидлвари', () => {
    expect(normalizeError(401, null).code).toBe('INVALID_TOKEN');
    expect(normalizeError(403, null).code).toBe('FORBIDDEN');
  });

  it('5xx → UPSTREAM_UNAVAILABLE', () => {
    expect(normalizeError(502, null).code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
