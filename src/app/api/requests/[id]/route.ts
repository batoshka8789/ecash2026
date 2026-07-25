import { withUser } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { getRequest } from '@/server/ecash/endpoints/reserve';
import { readSession } from '@/server/session';
import { demoGet, isDemoToken } from '@/server/demo/store';

/** GET /api/requests/[id] — карточка заявки: срок брони, акцепты, история, талон. */
export const GET = withUser(async (_req, token, ctx) => {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail('errors.REQUEST_NOT_FOUND', 404);
  }

  try {
    if (isDemoToken(token)) {
      const s = await readSession();
      const r = demoGet(s!.accountId, requestId);
      return r ? ok({ request: r }) : fail('errors.REQUEST_NOT_FOUND', 404);
    }
    return ok({ request: await getRequest(token, requestId) });
  } catch (e) {
    return fromError(e);
  }
});
