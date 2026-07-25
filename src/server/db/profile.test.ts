import { describe, expect, it } from 'vitest';
import { emptyProfile, profileFromRow } from './profile';

/** Строка profiles: только поля, которые читает profileFromRow. */
type Row = Parameters<typeof profileFromRow>[0];
const row = (tags: unknown): Row =>
  ({
    accountId: 'demo-1',
    avatar: null,
    about: 'о себе',
    occupation: 'инженер',
    tags,
    address: 'пр. Достык, 89',
    updatedAt: new Date(),
  }) as Row;

describe('profileFromRow', () => {
  it('без строки в БД отдаёт пустую анкету', () => {
    expect(profileFromRow(undefined)).toEqual(emptyProfile);
  });

  it('пробрасывает поля и массив тегов как есть', () => {
    const p = profileFromRow(row(['investor', 'director']));
    expect(p.about).toBe('о себе');
    expect(p.occupation).toBe('инженер');
    expect(p.address).toBe('пр. Достык, 89');
    expect(p.tags).toEqual(['investor', 'director']);
  });

  it('не-массив в jsonb превращает в пустой массив, а не роняет форму', () => {
    // jsonb хранит что угодно: `{}` после ручной правки данных валил
    // `tags.includes(...)` в анкете профиля
    expect(profileFromRow(row({})).tags).toEqual([]);
    expect(profileFromRow(row(null)).tags).toEqual([]);
    expect(profileFromRow(row('investor')).tags).toEqual([]);
    expect(profileFromRow(row(42)).tags).toEqual([]);
  });

  it('отбрасывает нестроковые элементы внутри массива', () => {
    expect(profileFromRow(row(['investor', 7, null, 'director'])).tags).toEqual([
      'investor',
      'director',
    ]);
  });
});
