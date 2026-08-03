import { NextResponse } from 'next/server';
import { withUser } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { accountPatchBody } from '@/shared/schemas';
import { updateClient } from '@/server/ecash/endpoints/account';
import { currentAccount } from '@/server/account';
import { DEMO_OTP, demoSetPhone, isDemoToken } from '@/server/demo/store';
import { createSession, readSession } from '@/server/session';
import { otpConfirm } from '@/server/ecash/endpoints/otp';
import { env } from '@/server/env';

/**
 * Контакты аккаунта Ecash — номер телефона и почта.
 *
 * Ручка `PUT /mobile/account/update-client` существовала в слое интеграции с
 * самого начала, но её никто не вызывал: телефон в профиле был помечен
 * «изменить можно только в отделении», хотя ядро смену поддерживает. Отсюда
 * жалоба «не изменяется номер телефона».
 *
 * Телефон — логин аккаунта, поэтому пишем его только через ядро: локальной
 * копии, которая могла бы разойтись с настоящей, у нас нет. И по той же
 * причине смена номера подтверждается SMS-кодом на НОВЫЙ номер — проверяем
 * его здесь же, до записи: у угнанной сессии не должно быть возможности
 * увести аккаунт на чужой телефон.
 */
export const PATCH = withUser(async (req, token) => {
  const parsed = await body(req, accountPatchBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    if (parsed.phoneNumber && parsed.otp) {
      // purpose 0 (регистрация): код уходит на номер, который ЕЩЁ НЕ ЗАНЯТ —
      // ровно нужная семантика, занятый номер апстрим отклонит сам
      // (409 PHONE_ALREADY_REGISTERED) ещё на шаге отправки кода.
      const confirmed = env.ECASH_OTP_MOCK
        ? parsed.otp === DEMO_OTP
        : (await otpConfirm(parsed.phoneNumber, parsed.otp, 0)).isConfirmed;
      if (!confirmed) return fail('errors.INVALID_OTP', 401);
    }

    if (isDemoToken(token)) {
      // В демо-режиме ядра нет. accountId выведен из телефона, менять его
      // нельзя — иначе порвётся сессия и потеряются заявки, поэтому новый
      // номер держим отдельным оверрайдом поверх демо-аккаунта.
      const s = await readSession();
      if (parsed.phoneNumber) demoSetPhone(s!.accountId, parsed.phoneNumber);
    } else {
      await updateClient(token, parsed);
    }

    const account = await currentAccount();
    if (!account) return fail('errors.unauthorized', 401);

    /**
     * Телефон в сессии — не кэш для показа (профиль читает ядро), а основа
     * проверки прав админа: sessionIsAdmin() сверяет его с ADMIN_PHONES, а в
     * Server Component ни сети, ни записи кук нет. После смены номера там
     * оставался старый, и админ, сменивший телефон, терял раздел до перелогина
     * (а сменивший НА админский — наоборот, прав не получал).
     */
    const s = await readSession();
    if (s && account.phoneNumber && account.phoneNumber !== s.phone) {
      await createSession({ ...s, phone: account.phoneNumber });
    }
    return ok({ account });
  } catch (e) {
    return fromError(e);
  }
});
