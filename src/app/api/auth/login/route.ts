import { db } from '@/server/db';
import { createSession } from '@/server/session';
import { body, EMAIL_RE, fail, isPhone, ok } from '@/server/http';

/**
 * Вход. В макете поле подписано «Номер телефона или эл.почта»,
 * поэтому принимаем оба варианта.
 */
export async function POST(req: Request) {
  const data = await body<{ login?: string; password?: string }>(req);
  const login = data?.login?.trim() ?? '';
  const password = data?.password ?? '';

  if (!login) return fail('errors.required', 400, 'login');
  if (!EMAIL_RE.test(login) && !isPhone(login)) return fail('errors.emailInvalid', 400, 'login');
  if (!password) return fail('errors.required', 400, 'password');

  const user = db.users.find(
    (u) => u.email.toLowerCase() === login.toLowerCase() || u.phone.replace(/\D/g, '') === login.replace(/\D/g, ''),
  );
  if (!user) return fail('errors.emailInvalid', 401, 'login');
  if (db.passwords.get(user.email) !== password) return fail('errors.wrongPassword', 401, 'password');

  await createSession(user.id);
  return ok({ user });
}
