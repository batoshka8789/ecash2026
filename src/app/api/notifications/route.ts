import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { rateAlerts } from '@/server/db/schema';
import { withUser } from '@/server/api/guard';
import { fromError, ok } from '@/server/api/respond';
import { listOperations } from '@/server/ecash/endpoints/reserve';
import { readSession } from '@/server/session';
import { demoList, isDemoToken } from '@/server/demo/store';
import type { CurrencyCode, ExchangeRequest } from '@/lib/domain';

/**
 * Уведомления — проекция заявок (upstream) и подписок на курс (наша БД).
 * Отдельного эндпоинта уведомлений в API Ecash нет.
 */

type NotificationDto = {
  id: string;
  badges: string[];
  titleKey: string;
  createdAt: string | null;
  side: 'buy' | 'sell';
  amount: string;
  /** пара валют — определяет, какие два флага показать в бейдже строки */
  currencyFrom: CurrencyCode;
  currencyTo: CurrencyCode;
  requestId: number | null;
  reservedUntil: string | null;
  needsClientConfirmation: boolean;
  phase: string;
  actions: string[];
  /** id подписки на курс — для действия 'disable'; у заявок всегда null. */
  alertId: string | null;
};

function fromRequest(r: ExchangeRequest): NotificationDto {
  const badges: string[] = [];
  if (r.isIndividual) badges.push('individual');
  else if (r.phase === 'held') badges.push('booking30');

  let titleKey = 'bookedPair';
  const actions: string[] = [];
  if (r.isIndividual) {
    titleKey = r.needsClientConfirmation ? 'offerReviewed' : 'offerSent';
    if (r.needsClientConfirmation) actions.push('individual');
  } else if (r.phase === 'cancelled') {
    titleKey = 'bookedPair';
  }

  return {
    id: `req-${r.requestId}`,
    badges,
    titleKey,
    createdAt: r.updatedAt ?? r.createdAt,
    side: r.actionType,
    amount: `${r.value.toLocaleString('ru-RU')} (${r.currencyFrom})`,
    currencyFrom: r.currencyFrom,
    currencyTo: r.currencyTo,
    requestId: r.requestId,
    reservedUntil: r.reservedUntil,
    needsClientConfirmation: r.needsClientConfirmation,
    phase: r.phase,
    actions,
    alertId: null,
  };
}

export const GET = withUser(async (req, token) => {
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') === 'history' ? 'history' : 'actual';
  const s = await readSession();
  const accountId = s!.accountId;

  try {
    const page = isDemoToken(token)
      ? demoList(accountId, 1, 100)
      : await listOperations(token, 1, 100);

    const alerts = await db
      .select()
      .from(rateAlerts)
      .where(eq(rateAlerts.accountId, accountId))
      .orderBy(desc(rateAlerts.createdAt));

    const requestNotes = page.requests.map(fromRequest);
    const alertNotes: NotificationDto[] = alerts.map((a) => {
      const live = a.active && a.until.getTime() > Date.now();
      // Курс дошёл до отметки — это и есть само событие, ради которого
      // подписку заводили. Раньше firedAt не доходил до интерфейса вовсе:
      // заголовок «Курс достиг вашей отметки» лежал в переводах, но не
      // выставлялся никогда, и сработавшая подписка выглядела так же,
      // как только что созданная.
      const reached = a.firedAt !== null;

      return {
        id: `alert-${a.id}`,
        badges: ['rateAlert'],
        titleKey: reached ? 'rateReached' : live ? 'alertsOn' : 'alertsOff',
        // у сработавшей — время события: иначе она тонет в общем списке,
        // отсортированном по дате, на месте дня своего создания
        createdAt: (a.firedAt ?? a.createdAt).toISOString(),
        // направление закодировано порядком пары: KZT→валюта — покупка
        side: a.currencyFrom === 'KZT' ? 'buy' : 'sell',
        amount: `${Number(a.targetRate)} (₸)`,
        currencyFrom: a.currencyFrom as CurrencyCode,
        currencyTo: a.currencyTo as CurrencyCode,
        requestId: null,
        reservedUntil: null,
        needsClientConfirmation: false,
        // Отработавшая и просроченная подписки — уже история; в «Актуальном»
        // остаются действующие и только что сработавшие. Раньше здесь всегда
        // стояло 'pending', из-за чего отключённые подписки висели в
        // «Актуальном» вместе с надписью «Уведомления отключены».
        phase: live || reached ? 'pending' : 'ended',
        // сработала — предлагаем воспользоваться курсом; действует — отключить;
        // закончилась — возобновить (форма /subscribe)
        actions: reached ? ['book', 'disable'] : live ? ['disable'] : ['resume'],
        alertId: a.id,
      };
    });

    const all = [...requestNotes, ...alertNotes].sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
    );

    const isActual = (n: NotificationDto) =>
      n.phase === 'pending' || n.phase === 'held' || n.needsClientConfirmation;
    const notifications = all.filter((n) => (tab === 'actual' ? isActual(n) : !isActual(n)));
    const unread = all.filter(isActual).length;

    return ok({ notifications, unread, requests: page.requests });
  } catch (e) {
    return fromError(e);
  }
});
