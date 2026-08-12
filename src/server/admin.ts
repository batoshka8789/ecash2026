import 'server-only';
import type { Account } from '@/lib/domain';
import { env } from '@/server/env';
import { samePhone } from '@/shared/phone';

/**
 * Права администратора — ЕДИНСТВЕННОЕ место, где они решаются.
 *
 * Доступ привязан к номеру телефона: админ тот и только тот, чей номер
 * перечислен в ADMIN_PHONES. Ролей в Ecash Mobile API нет (проверено живым
 * запросом 10.08.2026: в JWT только `scope=mobile-service`, в
 * `/mobile/account/me` — accountId, phoneNumber, clientId, iin и ФИО), и
 * заводить их на нашей стороне мы не стали: свой список пользователей означал
 * бы вторую точку правды о личности, расходящуюся с ядром.
 *
 * Что делает эту привязку жёсткой:
 *
 *  · Номер берётся из ЖИВОГО ответа `/mobile/account/me` по действующему
 *    токену — то есть подтверждён входом через Ecash (пароль или SMS).
 *    Из куки номер для этой проверки не берётся никогда.
 *  · Право нигде не хранится и не кешируется: считается заново на каждом
 *    запросе, поэтому удаление номера из ADMIN_PHONES отбирает доступ
 *    немедленно, а не через 30 дней жизни сессии.
 *  · Сравнение по последним 10 цифрам (см. shared/phone.ts): формат записи
 *    не имеет значения, а номер короче 10 цифр не совпадёт ни с чем.
 *  · Пустой ADMIN_PHONES = админов нет вовсе; раздел закрыт всем.
 */

/** Номер входит в список администраторов. Единственное правило доступа. */
export function isAdminPhone(phone: string): boolean {
  if (!phone) return false;
  return env.ADMIN_PHONES.some((allowed) => samePhone(allowed, phone));
}

/** Права по аккаунту Ecash. Гость (null) администратором не является. */
export const isAdminAccount = (account: Account | null): boolean =>
  Boolean(account && isAdminPhone(account.phoneNumber));
