import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { franchiseLeads } from '@/server/db/schema';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { franchiseLeadBody } from '@/shared/schemas';

/** Лид с лендинга франшизы. Публичный, но с rate-limit от спама. */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'lead', 5, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, franchiseLeadBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const [row] = await db
      .insert(franchiseLeads)
      .values({
        name: parsed.name,
        phone: parsed.phone,
        city: parsed.city ?? '',
        funds: parsed.funds ?? '',
        experience: parsed.experience ?? '',
        tags: parsed.tags ?? [],
      })
      .returning();
    return ok({ lead: { id: row.id, createdAt: row.createdAt.toISOString() } }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
}
