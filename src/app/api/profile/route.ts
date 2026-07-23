import { currentUser } from '@/server/session';
import { body, fail, ok } from '@/server/http';
import type { User } from '@/lib/types';

/** Анкета «Мои данные»: чтение и сохранение. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail('errors.unauthorized', 401);
  return ok({ user });
}

const EDITABLE = [
  'firstName',
  'lastName',
  'middleName',
  'iin',
  'phone',
  'about',
  'occupation',
  'address',
] as const;

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return fail('errors.unauthorized', 401);

  const data = await body<Partial<User>>(req);
  if (!data) return fail('errors.badBody');

  for (const field of EDITABLE) {
    const value = data[field];
    if (typeof value === 'string') user[field] = value;
  }
  if (Array.isArray(data.tags)) user.tags = data.tags.filter((t) => typeof t === 'string');

  return ok({ user });
}
