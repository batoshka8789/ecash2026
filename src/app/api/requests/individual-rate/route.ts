import { NextResponse } from 'next/server';
import { withUser } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createIndividualRate } from '@/server/ecash/endpoints/reserve';
import { depList } from '@/server/ecash/endpoints/departments';
import { createRequestBody } from '@/shared/schemas';
import { syncWatch } from '@/server/request-watch';
import { readSession } from '@/server/session';

/** POST /api/requests/individual-rate — заявка на индивидуальный курс (rate = желаемый). */
export const POST = withUser(async (req, token) => {
  const parsed = await body(req, createRequestBody);
  if (parsed instanceof NextResponse) return parsed;

  // как и у обычной брони: меньше одной целой единицы валюты — заявки нет
  // (у ядра это 400 VALUE_TOO_SMALL, раздел 4.1)
  if (parsed.currencyFrom === 'KZT' && Math.floor(parsed.value / parsed.rate + 1e-9) < 1) {
    return fail('errors.VALUE_TOO_SMALL', 400, { field: 'value' });
  }

  try {
    // depId проверяем по реальному списку отделений — та же дыра, что и у обычной брони.
    if (parsed.depId != null) {
      const deps = await depList();
      if (!deps.some((d) => d.depId === parsed.depId)) {
        return fail('errors.DEPARTMENT_NOT_FOUND', 404, { field: 'depId' });
      }
    }
    const request = await createIndividualRate(token, parsed);
    const s = await readSession();
    if (s) void syncWatch(s.accountId, request);
    return ok({ request }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
});
