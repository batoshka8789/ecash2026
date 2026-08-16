import { withUser } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { rejectIndividualRate } from '@/server/ecash/endpoints/reserve';
import { syncWatch } from '@/server/request-watch';
import { readSession } from '@/server/session';

/** Отказ от предложенного индивидуального курса — заявка переходит в «Отмена». */
export const POST = withUser(async (_req, token, ctx) => {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail('errors.REQUEST_NOT_FOUND', 404);
  }

  try {
    const request = await rejectIndividualRate(token, requestId);
    const s = await readSession();
    if (s) void syncWatch(s.accountId, request); // собственное решение — без push
    return ok({ request });
  } catch (e) {
    return fromError(e);
  }
});
