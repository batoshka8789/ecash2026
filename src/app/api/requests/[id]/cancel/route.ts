import { NextResponse } from 'next/server';
import { withUser } from '@/server/api/guard';
import { fail, fromError, ok, optionalBody } from '@/server/api/respond';
import { cancelRequest } from '@/server/ecash/endpoints/reserve';
import { cancelRequestBody } from '@/shared/schemas';
import { readSession } from '@/server/session';
import { demoCancel, isDemoToken } from '@/server/demo/store';

/** POST /api/requests/[id]/cancel — отмена заявки/брони, резерв возвращается в кассу. */
export const POST = withUser(async (req, token, ctx) => {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail('errors.REQUEST_NOT_FOUND', 404);
  }

  // тело опционально ({comment?}) — отсутствие JSON не должно быть ошибкой
  const parsed = await optionalBody(req, cancelRequestBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    if (isDemoToken(token)) {
      const s = await readSession();
      // уже терминальная заявка → store бросает REQUEST_NOT_CANCELLABLE (409 через fromError)
      const r = demoCancel(s!.accountId, requestId);
      if (!r) return fail('errors.REQUEST_NOT_FOUND', 404);
      return ok({ request: r });
    }
    return ok({ request: await cancelRequest(token, requestId, parsed.comment) });
  } catch (e) {
    return fromError(e);
  }
});
