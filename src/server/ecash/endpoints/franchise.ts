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
 * В контракте заказчика все пять полей присутствуют в теле всегда
 * (businessDescription/comment — строки, amount — число). Наша анкета
 * сокращена до ФИО + телефона, поэтому отсутствующие поля добиваем
 * пустыми значениями сами — чтобы не зависеть от того, как упстрим
 * относится к отсутствующим ключам.
 */
export const submitFranchise = (payload: FranchisePayload) =>
  ecashFetch<unknown>('/mobile/franchise', {
    method: 'POST',
    body: {
      fullName: payload.fullName,
      phoneNumber: payload.phoneNumber,
      businessDescription: payload.businessDescription ?? '',
      amount: payload.amount ?? 0,
      comment: payload.comment ?? '',
    },
  });
