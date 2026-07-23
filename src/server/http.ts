import 'server-only';

import { NextResponse } from 'next/server';

/** Успешный ответ. */
export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

/** Ошибка в едином формате: { error, field? }. */
export const fail = (error: string, status = 400, field?: string) =>
  NextResponse.json({ error, ...(field ? { field } : {}) }, { status });

/** Безопасно читает JSON-тело запроса. */
export async function body<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Телефон в свободном формате — считаем валидным от 10 цифр. */
export const isPhone = (v: string) => (v.match(/\d/g) ?? []).length >= 10;
