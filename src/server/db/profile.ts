import 'server-only';
import type { Profile } from '@/lib/domain';
import type { profiles } from './schema';

/** Пустая анкета — у аккаунта может не быть строки в profiles. */
export const emptyProfile: Profile = {
  avatar: null,
  about: '',
  occupation: '',
  tags: [],
  address: '',
};

type ProfileRow = typeof profiles.$inferSelect;

/**
 * Строка `profiles` → доменная анкета.
 *
 * `tags` лежит в jsonb, а `$type<string[]>()` у Drizzle — только подсказка
 * компилятору: в рантайме там может оказаться что угодно (например объект
 * `{}` после ручной правки данных), и тогда `tags.includes(...)` в форме
 * профиля падает. Поэтому нормализуем на выходе из БД: контракт API обещает
 * массив строк — значит массив строк и отдаём.
 */
export function profileFromRow(row: ProfileRow | undefined): Profile {
  if (!row) return emptyProfile;
  return {
    avatar: row.avatar,
    about: row.about,
    occupation: row.occupation,
    tags: normalizeTags(row.tags),
    address: row.address,
  };
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}
