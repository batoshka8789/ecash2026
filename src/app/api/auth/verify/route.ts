import { db, newId } from '@/server/db';
import { createSession } from '@/server/session';
import { body, fail, ok } from '@/server/http';
import type { User } from '@/lib/types';

/** Подтверждение почты кодом — завершает регистрацию и открывает сессию. */
export async function POST(req: Request) {
  const data = await body<{ email?: string; code?: string; phone?: string }>(req);
  const email = data?.email?.trim().toLowerCase() ?? '';
  const code = data?.code?.trim() ?? '';

  const expected = db.codes.get(email);
  if (!expected) return fail('errors.codeExpired', 400, 'code');
  if (code !== expected) return fail('errors.codeInvalid', 400, 'code');

  db.codes.delete(email);

  const user: User = {
    id: newId(),
    email,
    phone: data?.phone?.trim() || '',
    firstName: '',
    lastName: '',
    middleName: '',
    iin: '',
    about: '',
    occupation: '',
    tags: [],
    address: '',
    avatar: '',
  };
  db.users.push(user);
  await createSession(user.id);

  return ok({ user });
}
