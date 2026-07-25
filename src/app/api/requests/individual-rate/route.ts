import { NextResponse } from 'next/server';
import { withUser } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createIndividualRate } from '@/server/ecash/endpoints/reserve';
import { depList } from '@/server/ecash/endpoints/departments';
import { createRequestBody } from '@/shared/schemas';
import { readSession } from '@/server/session';
import { demoCreate, isDemoToken } from '@/server/demo/store';
import type { ExchangeRequest } from '@/lib/domain';

/** POST /api/requests/individual-rate — заявка на индивидуальный курс (rate = желаемый). */
export const POST = withUser(async (req, token) => {
  const parsed = await body(req, createRequestBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    // depId проверяем по реальному списку отделений — та же дыра, что и у обычной брони.
    if (parsed.depId != null) {
      const deps = await depList();
      if (!deps.some((d) => d.depId === parsed.depId)) {
        return fail('errors.DEPARTMENT_NOT_FOUND', 404, { field: 'depId' });
      }
    }
    if (isDemoToken(token)) {
      const s = await readSession();
      try {
        return ok({ request: demoCreate(s!.accountId, parsed, true) }, { status: 201 });
      } catch (err) {
        const dup = (err as { demoDuplicate?: ExchangeRequest }).demoDuplicate;
        if (dup) return ok({ error: 'errors.REQUEST_ALREADY_EXISTS', data: dup }, { status: 409 });
        throw err;
      }
    }
    return ok({ request: await createIndividualRate(token, parsed) }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
});
