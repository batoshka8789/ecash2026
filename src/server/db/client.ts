import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/server/env';
import * as schema from './schema';

/** Пул подключений в globalThis — переживает HMR в dev. */
const g = globalThis as unknown as { __ecashPg?: ReturnType<typeof postgres> };
const client = (g.__ecashPg ??= postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 5,
}));

export const db = drizzle(client, { schema });
export type Db = typeof db;
