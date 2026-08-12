import { NextResponse } from 'next/server';
import { withUser } from '@/server/api/guard';
import { fail, fromError, ok, optionalBody } from '@/server/api/respond';
import { cancelRequest } from '@/server/ecash/endpoints/reserve';
import { cancelRequestBody } from '@/shared/schemas';

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
    // терминальная заявка → upstream отвечает REQUEST_NOT_CANCELLABLE (409 через fromError)
    return ok({ request: await cancelRequest(token, requestId, parsed.comment) });
  } catch (e) {
    return fromError(e);
  }
});
