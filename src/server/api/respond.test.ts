import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { body, optionalBody } from './respond';

/** body() для обязательных тел и optionalBody() для полностью опциональных схем. */

const optionalSchema = z.object({ comment: z.string().trim().max(500).optional() });
const requiredSchema = z.object({ name: z.string().min(1, 'errors.required') });

const post = (payload?: string) =>
  new Request('http://localhost/api/test', { method: 'POST', body: payload });

describe('body', () => {
  it('валидный JSON разбирается по схеме', async () => {
    const r = await body(post('{"name":"x"}'), requiredSchema);
    expect(r).toEqual({ name: 'x' });
  });

  it('отсутствующее тело — по-прежнему 400 errors.badBody', async () => {
    const r = await body(post(), requiredSchema);
    expect(r).toBeInstanceOf(Response);
    const res = r as Response;
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'errors.badBody' });
  });

  it('битый JSON — 400 errors.badBody', async () => {
    const r = await body(post('{oops'), requiredSchema);
    expect((r as Response).status).toBe(400);
  });
});

describe('optionalBody', () => {
  it('отсутствующее тело трактуется как {}', async () => {
    const r = await optionalBody(post(), optionalSchema);
    expect(r).toEqual({});
  });

  it('пустая строка и пробелы трактуются как {}', async () => {
    expect(await optionalBody(post(''), optionalSchema)).toEqual({});
    expect(await optionalBody(post('  \n'), optionalSchema)).toEqual({});
  });

  it('валидный JSON разбирается по схеме', async () => {
    const r = await optionalBody(post('{"comment":"передумал"}'), optionalSchema);
    expect(r).toEqual({ comment: 'передумал' });
  });

  it('битый JSON — 400 errors.badBody', async () => {
    const r = await optionalBody(post('{oops'), optionalSchema);
    expect(r).toBeInstanceOf(Response);
    const res = r as Response;
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'errors.badBody' });
  });

  it('невалидные данные отклоняются схемой', async () => {
    const r = await optionalBody(post('{"comment":42}'), optionalSchema);
    expect((r as Response).status).toBe(400);
  });

  it('обязательная схема с пустым телом не проходит', async () => {
    const r = await optionalBody(post(), requiredSchema);
    expect((r as Response).status).toBe(400);
  });
});
