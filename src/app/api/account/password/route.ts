import { NextResponse } from 'next/server';
import { withUser } from '@/server/api/guard';
import { rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { changePasswordBody } from '@/shared/schemas';
import { changePassword } from '@/server/ecash/endpoints/account';
import { EcashError } from '@/server/ecash/errors';

/**
 * Смена пароля залогиненным человеком: знает текущий — меняет на новый.
 *
 * Отличие от `/api/auth/otp/reset-password`: там владение подтверждается
 * SMS-кодом (для тех, кто пароль забыл), здесь — знанием текущего пароля.
 * Ядро проверяет его само, мы ему не подыгрываем: неверный текущий пароль
 * возвращается как ошибка апстрима, а не как наша.
 *
 * Лимит жёстче, чем у входа (5 против 10): подбор ТЕКУЩЕГО пароля через эту
 * ручку — тот же брутфорс, только из-под живой сессии, где вход уже не нужен.
 */
export const POST = withUser(async (req, token) => {
  if (rateLimited(req, 'change-password', 5, 60_000)) {
    return fail('errors.tooManyRequests', 429);
  }

  const parsed = await body(req, changePasswordBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const changed = await changePassword(token, parsed.currentPassword, parsed.newPassword);
    // ядро ответило успехом, но явным false в теле — наружу это отказ, а не
    // «изменено»: см. историю otpResetPassword, где 200 не значил смену
    if (!changed) return fail('errors.currentPasswordWrong', 400, { field: 'currentPassword' });
    return ok({ changed: true });
  } catch (e) {
    /**
     * Ядро на неверный текущий пароль отвечает тем же INVALID_CREDENTIALS, что
     * и на неудачный вход, — а он переводится как «Неверный логин или пароль».
     * В форме, где логина нет вовсе, это сбивает с толку и выглядит как чужая
     * ошибка. Подменяем на точную формулировку и привязываем к полю, чтобы
     * подсветилось именно оно.
     *
     * Только этот код: остальные ошибки (сеть, таймаут, слабый пароль по
     * правилам ядра) должны доходить как есть, а не маскироваться под
     * «неверный пароль».
     */
    if (e instanceof EcashError && e.code === 'INVALID_CREDENTIALS') {
      return fail('errors.currentPasswordWrong', 400, { field: 'currentPassword' });
    }
    return fromError(e);
  }
});
