import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { profiles } from '@/server/db/schema';
import { register } from '@/server/ecash/endpoints/auth';
import { otpConfirm } from '@/server/ecash/endpoints/otp';
import { accountMe } from '@/server/ecash/endpoints/account';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createSession, sessionFromTokens } from '@/server/session';
import { registerBody, splitFullName } from '@/shared/schemas';

/** Регистрация: телефон подтверждён OTP (purpose 0) → пароль → сессия. */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'register', 5, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, registerBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    // подтверждаем код; upstream гасит его после успешной проверки
    const confirm = await otpConfirm(parsed.phoneNumber, parsed.otp, 0);
    if (!confirm.isConfirmed) return fail('errors.INVALID_OTP', 401, { field: 'otp' });

    const tokens = await register(parsed.phoneNumber, parsed.password, parsed.iin);
    const account = await accountMe(tokens.accessToken);
    await createSession(sessionFromTokens(tokens, account.accountId, account.phoneNumber));

    /**
     * Имя и фамилию кладём в свою анкету: в ядре Ecash полей под них нет, а
     * без них бронь пришлось бы подписывать вручную при каждом заказе.
     *
     * Сбой записи не отменяет регистрацию: аккаунт в Ecash уже создан и
     * повторить тот же запрос нельзя — номер занят. Человек в этом случае
     * зарегистрирован и вошёл, просто имя надо будет ввести в профиле.
     */
    try {
      // форма спрашивает ФИО одной строкой — раскладываем по полям анкеты,
      // чтобы профиль и ядро Ecash видели привычные им части
      const name = splitFullName(parsed.fullName);
      await db
        .insert(profiles)
        .values({ accountId: account.accountId, ...name, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: profiles.accountId,
          set: { ...name, updatedAt: new Date() },
        });
    } catch (e) {
      console.warn('[register] имя не сохранилось, аккаунт создан', e);
    }

    return ok({ account }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
}
