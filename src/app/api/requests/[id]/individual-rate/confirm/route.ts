import { withUser } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { confirmIndividualRate } from '@/server/ecash/endpoints/reserve';
import { syncWatch } from '@/server/request-watch';
import { readSession } from '@/server/session';

/** Согласие с предложенным курсом: фиксируется, бронь запрашивается автоматически. */
export const POST = withUser(async (_req, token, ctx) => {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail('errors.REQUEST_NOT_FOUND', 404);
  }

  try {
    const request = await confirmIndividualRate(token, requestId);
    const s = await readSession();
    if (s) void syncWatch(s.accountId, request); // собственное решение — без push
    return ok({ request });
  } catch (e) {
    return fromError(e);
  }
});
