import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { profiles } from '@/server/db/schema';
import { withUser } from '@/server/api/guard';
import { body, fromError, ok } from '@/server/api/respond';
import { profilePatchBody } from '@/shared/schemas';
import { profileFromRow } from '@/server/db/profile';
import { readSession } from '@/server/session';

/**
 * Анкета — наш слой (в API Ecash её нет, документация относит
 * профиль/аватар «в мобильный слой»). Ключ — accountId из токена.
 */

export const PATCH = withUser(async (req) => {
  const parsed = await body(req, profilePatchBody);
  if (parsed instanceof NextResponse) return parsed;

  const s = await readSession();
  const accountId = s!.accountId;

  try {
    const [row] = await db
      .insert(profiles)
      .values({ accountId, ...clean(parsed), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: profiles.accountId,
        set: { ...clean(parsed), updatedAt: new Date() },
      })
      .returning();

    return ok({ profile: profileFromRow(row) });
  } catch (e) {
    return fromError(e);
  }
});

/** undefined-поля не должны затирать существующие значения. */
function clean(p: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
}
