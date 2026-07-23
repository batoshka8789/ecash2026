import { db } from '@/server/db';
import { body, EMAIL_RE, fail, ok } from '@/server/http';

/**
 * Восстановление пароля в три шага, как в макете:
 * step=request → код на почту, step=confirm → проверка кода,
 * step=reset → новый пароль.
 */
export async function POST(req: Request) {
  const data = await body<{
    step?: 'request' | 'confirm' | 'reset';
    email?: string;
    code?: string;
    password?: string;
    password2?: string;
  }>(req);

  const email = data?.email?.trim().toLowerCase() ?? '';
  if (!EMAIL_RE.test(email)) return fail('errors.emailInvalid', 400, 'email');

  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user) return fail('errors.emailInvalid', 404, 'email');

  if (data?.step === 'request') {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.codes.set(email, code);
    return ok({ sent: true, devCode: code });
  }

  if (data?.step === 'confirm') {
    if (db.codes.get(email) !== data?.code?.trim()) return fail('errors.codeInvalid', 400, 'code');
    return ok({ confirmed: true });
  }

  if (data?.step === 'reset') {
    if (db.codes.get(email) !== data?.code?.trim()) return fail('errors.codeInvalid', 400, 'code');
    const password = data?.password ?? '';
    if (password.length < 8) return fail('errors.passwordMin', 400, 'password');
    if (!/\d/.test(password)) return fail('errors.passwordDigit', 400, 'password');
    if (password !== data?.password2) return fail('errors.passwordMatch', 400, 'password2');
    db.passwords.set(user.email, password);
    db.codes.delete(email);
    return ok({ reset: true });
  }

  return fail('errors.unknownStep');
}
