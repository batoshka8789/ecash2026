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
