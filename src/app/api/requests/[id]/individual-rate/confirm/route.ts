import { withUser } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { confirmIndividualRate } from '@/server/ecash/endpoints/reserve';
import { readSession } from '@/server/session';
import { demoConfirmIndividual, isDemoToken } from '@/server/demo/store';

/** Согласие с предложенным курсом: фиксируется, бронь запрашивается автоматически. */
export const POST = withUser(async (_req, token, ctx) => {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail('errors.REQUEST_NOT_FOUND', 404);
  }

  try {
    if (isDemoToken(token)) {
      const s = await readSession();
      const r = demoConfirmIndividual(s!.accountId, requestId);
      return r ? ok({ request: r }) : fail('errors.REQUEST_NOT_FOUND', 404);
    }
    return ok({ request: await confirmIndividualRate(token, requestId) });
  } catch (e) {
    return fromError(e);
  }
});
