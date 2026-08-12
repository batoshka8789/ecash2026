import { withUser } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { getRequest } from '@/server/ecash/endpoints/reserve';

/** GET /api/requests/[id] — карточка заявки: срок брони, акцепты, история, талон. */
export const GET = withUser(async (_req, token, ctx) => {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail('errors.REQUEST_NOT_FOUND', 404);
  }

  try {
    return ok({ request: await getRequest(token, requestId) });
  } catch (e) {
    return fromError(e);
  }
});
