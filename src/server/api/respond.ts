import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { EcashError } from '@/server/ecash/errors';

/**
 * Единый формат ответов BFF:
 *   успех:  { data } + X-Server-Time (коррекция часов клиента)
 *   ошибка: { error: "<i18n-код>", field?, data? }
 */

const serverTime = () => ({ 'x-server-time': new Date().toISOString() });

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, { ...init, headers: { ...serverTime(), ...init?.headers } });
}

export function fail(
  error: string,
  status = 400,
  extra?: { field?: string; data?: unknown },
): NextResponse {
  return NextResponse.json(
    {
      error,
      ...(extra?.field ? { field: extra.field } : {}),
      ...(extra?.data !== undefined ? { data: extra.data } : {}),
    },
    { status, headers: serverTime() },
  );
}

/** Безопасный разбор тела: null вместо исключения на пустом/битом JSON. */
export async function body<T>(req: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  const raw = await req.json().catch(() => null);
  if (raw === null) return fail('errors.badBody');
  const r = schema.safeParse(raw);
  if (!r.success) return zodFail(r.error);
  return r.data;
}

/**
 * Как body(), но отсутствующее/пустое тело эквивалентно {} — для схем,
 * где все поля опциональны (например, cancel с необязательным comment).
 * Битый JSON по-прежнему ошибка.
 */
export async function optionalBody<T>(req: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  const text = (await req.text().catch(() => '')).trim();
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      return fail('errors.badBody');
    }
  }
  const r = schema.safeParse(raw);
  if (!r.success) return zodFail(r.error);
  return r.data;
}

export function zodFail(err: ZodError): NextResponse {
  const first = err.issues[0];
  const message = first?.message?.startsWith('errors.') ? first.message : 'errors.badBody';
  return fail(message, 400, { field: first?.path?.map(String).join('.') || undefined });
}

/**
 * Преобразование ошибок серверного слоя в HTTP-ответ.
 * Код EcashError напрямую становится ключом i18n errors.<CODE>.
 */
export function fromError(e: unknown): NextResponse {
  if (e instanceof EcashError) {
    return fail(`errors.${e.code}`, e.httpStatus, {
      field: e.fields?.[0],
      data: e.data,
    });
  }
  console.error('[api] unexpected', e);
  return fail('errors.unknown', 500);
}
