import { withUser } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { getRequest } from '@/server/ecash/endpoints/reserve';
import { syncWatch } from '@/server/request-watch';
import { readSession } from '@/server/session';

/** GET /api/requests/[id] — карточка заявки: срок брони, акцепты, история, талон. */
export const GET = withUser(async (_req, token, ctx) => {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail('errors.REQUEST_NOT_FOUND', 404);
  }

  try {
    const request = await getRequest(token, requestId);
    // открытая карточка = человек в курсе; наблюдение синхронизируется,
    // чтобы push не дублировал то, что уже на экране
    const s = await readSession();
    if (s) void syncWatch(s.accountId, request);
    return ok({ request });
  } catch (e) {
    return fromError(e);
  }
});
