import { withUser } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { rejectIndividualRate } from '@/server/ecash/endpoints/reserve';

/** Отказ от предложенного индивидуального курса — заявка переходит в «Отмена». */
export const POST = withUser(async (_req, token, ctx) => {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail('errors.REQUEST_NOT_FOUND', 404);
  }

  try {
    return ok({ request: await rejectIndividualRate(token, requestId) });
  } catch (e) {
    return fromError(e);
  }
});
