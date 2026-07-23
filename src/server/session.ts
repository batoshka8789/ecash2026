import 'server-only';

import { cookies } from 'next/headers';
import { db, newId } from './db';
import type { User } from '@/lib/types';

const COOKIE = 'ecash_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

/** Заводит сессию и кладёт httpOnly-куку. */
export async function createSession(userId: string) {
  const id = newId();
  db.sessions.set(id, { userId, createdAt: Date.now() });
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
  return id;
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) db.sessions.delete(id);
  jar.delete(COOKIE);
}

/** Текущий пользователь или null — без бросков, чтобы вызывать где угодно. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const session = db.sessions.get(id);
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
}

/** Ключ владельца данных: пользователь или общий гостевой. */
export async function ownerKey(): Promise<string> {
  return (await currentUser())?.id ?? 'guest';
}
