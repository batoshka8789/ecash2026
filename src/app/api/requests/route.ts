import { NextResponse } from 'next/server';
import { withUser } from '@/server/api/guard';
import { body, fail, fromError, ok, zodFail } from '@/server/api/respond';
import { createReserve, listOperations } from '@/server/ecash/endpoints/reserve';
import { depList } from '@/server/ecash/endpoints/departments';
import { createRequestBody, listRequestsQuery } from '@/shared/schemas';
import { readSession } from '@/server/session';
import { demoCreate, demoList, isDemoToken } from '@/server/demo/store';
import type { ExchangeRequest } from '@/lib/domain';

/** GET /api/requests — постраничный список заявок аккаунта. */
export const GET = withUser(async (req, token) => {
  const url = new URL(req.url);
  const q = listRequestsQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return zodFail(q.error);

  try {
    if (isDemoToken(token)) {
      const s = await readSession();
      return ok(demoList(s!.accountId, q.data.page, q.data.pageSize));
    }
    return ok(await listOperations(token, q.data.page, q.data.pageSize));
  } catch (e) {
    return fromError(e);
  }
});

/** POST /api/requests — бронь. clientId/телефон/ИИН не передаются: бэкенд берёт их из аккаунта. */
export const POST = withUser(async (req, token) => {
  const parsed = await body(req, createRequestBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    // depId проверяем по реальному списку отделений (и в демо, и в реале)
    if (parsed.depId != null) {
      const deps = await depList();
      if (!deps.some((d) => d.depId === parsed.depId)) {
        return fail('errors.DEPARTMENT_NOT_FOUND', 404, { field: 'depId' });
      }
    }
    if (isDemoToken(token)) {
      const s = await readSession();
      try {
        return ok({ request: demoCreate(s!.accountId, parsed, false) }, { status: 201 });
      } catch (err) {
        const dup = (err as { demoDuplicate?: ExchangeRequest }).demoDuplicate;
        if (dup) return ok({ error: 'errors.REQUEST_ALREADY_EXISTS', data: dup }, { status: 409 });
        throw err;
      }
    }
    return ok({ request: await createReserve(token, parsed) }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
});
