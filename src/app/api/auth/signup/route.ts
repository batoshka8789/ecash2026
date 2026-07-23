import { db, newId } from '@/server/db';
import { body, EMAIL_RE, fail, ok } from '@/server/http';

/**
 * Регистрация: проверяем поля по правилам из макета
 * («Минимум 8 символов», «Хотя бы одна цифра») и выдаём код подтверждения.
 * Пользователь создаётся только после /api/auth/verify.
 */
export async function POST(req: Request) {
  const data = await body<{ email?: string; password?: string; password2?: string }>(req);
  const email = data?.email?.trim() ?? '';
  const password = data?.password ?? '';
  const password2 = data?.password2 ?? '';

  if (!EMAIL_RE.test(email)) return fail('errors.emailInvalid', 400, 'email');
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
    return fail('errors.emailTaken', 409, 'email');
  if (password.length < 8) return fail('errors.passwordMin', 400, 'password');
  if (!/\d/.test(password)) return fail('errors.passwordDigit', 400, 'password');
  if (password !== password2) return fail('errors.passwordMatch', 400, 'password2');

  // Код «письма» — бэкенд мок, поэтому возвращаем его прямо в ответе.
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.codes.set(email.toLowerCase(), code);
  db.passwords.set(email, password);

  return ok({ email, devCode: code, pendingId: newId() });
}
