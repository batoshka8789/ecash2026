import 'server-only';
import type { Locale } from '@/lib/domain';

/**
 * Тексты push-уведомлений на четырёх языках.
 *
 * Намеренно НЕ в messages/*.json: те словари читает next-intl, а он работает
 * внутри запроса — там есть локаль, заголовки и контекст. Push же уходит из
 * фоновой задачи (снапшоттер курсов), где никакого запроса нет вовсе, и
 * поднимать ради двух строк весь слой перевода не за что. Язык берётся из
 * поля locale подписки — он запомнен в момент, когда человек нажал «Включить».
 */

export type PushLocale = Locale;

const FALLBACK: PushLocale = 'ru';

/** Сводит что угодно из базы к поддерживаемому языку. */
export function toPushLocale(value: string | null | undefined): PushLocale {
  return value === 'en' || value === 'kk' || value === 'zh' ? value : FALLBACK;
}

/** Приветствие сразу после включения — оно же проверка, что канал живой. */
export const welcomeText: Record<PushLocale, { title: string; body: string }> = {
  ru: {
    title: 'Уведомления включены',
    body: 'Сообщим, как только курс дойдёт до вашей отметки — даже если вкладка закрыта.',
  },
  en: {
    title: 'Notifications are on',
    body: 'We will let you know as soon as the rate reaches your target — even with the tab closed.',
  },
  kk: {
    title: 'Хабарламалар қосылды',
    body: 'Бағам сіз белгілеген деңгейге жеткен бойда хабарлаймыз — қойынды жабық болса да.',
  },
  zh: {
    title: '通知已开启',
    body: '汇率一到达您设定的目标就会通知您——即使标签页已关闭。',
  },
};

/** Заголовок сработавшей подписки. */
export const alertTitle: Record<PushLocale, string> = {
  ru: 'Курс достиг вашей отметки',
  en: 'The rate reached your target',
  kk: 'Бағам сіз белгілеген деңгейге жетті',
  zh: '汇率已达到您的目标',
};

/**
 * Тело сообщения об одной валюте: «USD — 507 ₸. Можно покупать.»
 * Курс форматируется по тому же языку, поэтому разделитель разрядов
 * получается привычный носителю.
 */
export function alertBodyOne(
  locale: PushLocale,
  code: string,
  rate: number,
  side: 'buy' | 'sell',
): string {
  const value = formatRate(locale, rate);
  const line: Record<PushLocale, string> = {
    ru: `${code} — ${value} ₸. ${side === 'buy' ? 'Можно покупать' : 'Можно продавать'}.`,
    en: `${code} — ${value} ₸. ${side === 'buy' ? 'Good time to buy' : 'Good time to sell'}.`,
    kk: `${code} — ${value} ₸. ${side === 'buy' ? 'Сатып алуға болады' : 'Сатуға болады'}.`,
    zh: `${code} — ${value} ₸。${side === 'buy' ? '适合买入' : '适合卖出'}。`,
  };
  return line[locale];
}

/** Тело сообщения, когда в один проход сработало несколько валют. */
export function alertBodyMany(locale: PushLocale, codes: string[]): string {
  const list = codes.join(', ');
  const line: Record<PushLocale, string> = {
    ru: `${list} — курс дошёл до заданных значений.`,
    en: `${list} — the rates reached your targets.`,
    kk: `${list} — бағам белгіленген мәндерге жетті.`,
    zh: `${list} — 汇率已达到设定值。`,
  };
  return line[locale];
}

/** Курс без хвоста нулей, но с копейками, если они есть. */
function formatRate(locale: PushLocale, v: number): string {
  const tag = locale === 'kk' ? 'kk-KZ' : locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ru-RU';
  return v.toLocaleString(tag, { maximumFractionDigits: 2 });
}

// ------------------------------------------------------- решения казначея

import type { ExchangeRequest } from '@/lib/domain';
import type { WatchEvent } from '@/server/request-watch';

const NUM_LOCALE: Record<PushLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  kk: 'kk-KZ',
  zh: 'zh-CN',
};

const fmtRate = (locale: PushLocale, rate: number) =>
  new Intl.NumberFormat(NUM_LOCALE[locale], { maximumFractionDigits: 2 }).format(rate);

const REQUEST_TITLES: Record<WatchEvent, Record<PushLocale, string>> = {
  confirmed: {
    ru: 'Бронь подтверждена',
    en: 'Booking confirmed',
    kk: 'Броньдау расталды',
    zh: '预订已确认',
  },
  done: {
    ru: 'Обмен проведён',
    en: 'Exchange completed',
    kk: 'Айырбас өткізілді',
    zh: '兑换已完成',
  },
  cancelled: {
    ru: 'Заявка отменена',
    en: 'Request cancelled',
    kk: 'Өтінім жойылды',
    zh: '申请已取消',
  },
  offer: {
    ru: 'Казначей предложил курс',
    en: 'Individual rate offered',
    kk: 'Қазынашы бағам ұсынды',
    zh: '已提供个人汇率',
  },
};

const REQUEST_BODIES: Record<WatchEvent, Record<PushLocale, (pair: string, n: number) => string>> = {
  confirmed: {
    ru: (pair, n) => `${pair}. Заявка №${n} — ждём вас в отделении.`,
    en: (pair, n) => `${pair}. Request #${n} — see you at the branch.`,
    kk: (pair, n) => `${pair}. №${n} өтінім — бөлімшеде күтеміз.`,
    zh: (pair, n) => `${pair}。申请 #${n} — 请到网点办理。`,
  },
  done: {
    ru: (pair, n) => `${pair}. Заявка №${n} выполнена.`,
    en: (pair, n) => `${pair}. Request #${n} is complete.`,
    kk: (pair, n) => `${pair}. №${n} өтінім орындалды.`,
    zh: (pair, n) => `${pair}。申请 #${n} 已完成。`,
  },
  cancelled: {
    ru: (pair, n) => `${pair}. Заявка №${n} отменена — подробности внутри.`,
    en: (pair, n) => `${pair}. Request #${n} was cancelled — details inside.`,
    kk: (pair, n) => `${pair}. №${n} өтінім жойылды — егжей-тегжейі ішінде.`,
    zh: (pair, n) => `${pair}。申请 #${n} 已取消 — 详情见内。`,
  },
  offer: {
    ru: (pair, n) => `${pair}. Ответ по заявке №${n} — подтвердите в течение часа.`,
    en: (pair, n) => `${pair}. Reply on request #${n} — confirm within an hour.`,
    kk: (pair, n) => `${pair}. №${n} өтінімге жауап — бір сағат ішінде растаңыз.`,
    zh: (pair, n) => `${pair}。申请 #${n} 已有回复 — 请在一小时内确认。`,
  },
};

/**
 * Текст push о решении казначея. Пара с курсом даёт мгновенный контекст
 * («KZT → USD, 526,4»), номер заявки связывает с кабинетом.
 */
export function requestEventText(
  locale: PushLocale,
  event: WatchEvent,
  r: ExchangeRequest,
): { title: string; body: string } {
  const pair = `${r.currencyFrom} → ${r.currencyTo}, ${fmtRate(locale, r.rate)}`;
  return {
    title: REQUEST_TITLES[event][locale],
    body: REQUEST_BODIES[event][locale](pair, r.requestId),
  };
}
