import 'server-only';
import { ecashFetch } from '../http';

/**
 * Заявка на франшизу — POST /mobile/franchise. Единственный «контентный»
 * метод без авторизации (как и OTP): в примере заказчика curl без токена.
 */

export type FranchisePayload = {
  fullName: string;
  phoneNumber: string;
  businessDescription?: string;
  amount?: number;
  comment?: string;
};

/**
 * Отсутствующие текстовые поля добиваем пустыми строками (упстрим их
 * принимает), а вот amount при неизвестной сумме НЕ передаём вовсе:
 * 18.08.2026 у ядра появилась валидация «от 1 до 1000000000», и прежний
 * `amount: 0` стал ронять каждую заявку с 400 INVALID_AMOUNT — сайт
 * отвечал 502 на честно заполненную форму. Без ключа amount ядро заявку
 * принимает (проверено живой пробой: id 3, «Заявка принята»).
 */
export const submitFranchise = (payload: FranchisePayload) =>
  ecashFetch<unknown>('/mobile/franchise', {
    method: 'POST',
    body: {
      fullName: payload.fullName,
      phoneNumber: payload.phoneNumber,
      businessDescription: payload.businessDescription ?? '',
      ...(payload.amount != null && payload.amount > 0 ? { amount: payload.amount } : {}),
      comment: payload.comment ?? '',
    },
  });
