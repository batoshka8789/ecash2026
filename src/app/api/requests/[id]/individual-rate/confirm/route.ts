import { withUser } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { confirmIndividualRate } from '@/server/ecash/endpoints/reserve';

/** Согласие с предложенным курсом: фиксируется, бронь запрашивается автоматически. */
export const POST = withUser(async (_req, token, ctx) => {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail('errors.REQUEST_NOT_FOUND', 404);
  }

  try {
    return ok({ request: await confirmIndividualRate(token, requestId) });
  } catch (e) {
    return fromError(e);
  }
});
