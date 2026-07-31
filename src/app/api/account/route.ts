import { NextResponse } from 'next/server';
import { withUser } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { accountPatchBody } from '@/shared/schemas';
import { updateClient } from '@/server/ecash/endpoints/account';
import { currentAccount } from '@/server/account';
import { demoSetPhone, isDemoToken } from '@/server/demo/store';
import { readSession } from '@/server/session';

/**
 * Контакты аккаунта Ecash — номер телефона и почта.
 *
 * Ручка `PUT /mobile/account/update-client` существовала в слое интеграции с
 * самого начала, но её никто не вызывал: телефон в профиле был помечен
 * «изменить можно только в отделении», хотя ядро смену поддерживает. Отсюда
 * жалоба «не изменяется номер телефона».
 *
 * Телефон — логин аккаунта, поэтому пишем его только через ядро: локальной
 * копии, которая могла бы разойтись с настоящей, у нас нет.
 */
export const PATCH = withUser(async (req, token) => {
  const parsed = await body(req, accountPatchBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
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
    return ok({ account });
  } catch (e) {
    return fromError(e);
  }
});
