/** Форматирование чисел/дат по активной локали + названия валют. */

/** Локаль приложения (ru/en/kk) → BCP-47 для Intl. */
export function intlLocale(locale: string): string {
  return locale === 'kk' ? 'kk-KZ' : locale === 'en' ? 'en-US' : 'ru-RU';
}

const nfCache = new Map<string, Intl.NumberFormat>();

export function formatNumber(value: number, locale: string, digits = 2): string {
  const key = `${locale}:${digits}`;
  let nf = nfCache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(intlLocale(locale), {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
    nfCache.set(key, nf);
  }
  return nf.format(value);
}

export function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Гранулярность подписей графика курса: месяц (Янв…Дек по макету),
 * дата (12 мар) или время внутри суток (14:30).
 */
export type TickGranularity = 'month' | 'date' | 'time';

const TICK_OPTS: Record<TickGranularity, Intl.DateTimeFormatOptions> = {
  month: { month: 'short' },
  date: { day: 'numeric', month: 'short' },
  time: { hour: '2-digit', minute: '2-digit' },
};

/** Полная подпись точки — для подсказки и таблицы-фоллбэка графика. */
const STAMP_OPTS: Record<TickGranularity, Intl.DateTimeFormatOptions> = {
  month: { day: 'numeric', month: 'long', year: 'numeric' },
  date: { day: 'numeric', month: 'long' },
  time: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
};

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dtf(locale: string, kind: 'tick' | 'stamp', granularity: TickGranularity) {
  const key = `${locale}:${kind}:${granularity}`;
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(
      intlLocale(locale),
      kind === 'tick' ? TICK_OPTS[granularity] : STAMP_OPTS[granularity],
    );
    dtfCache.set(key, f);
  }
  return f;
}

/** Короткая подпись оси X графика. */
export function formatAxisTick(ms: number, locale: string, granularity: TickGranularity): string {
  return dtf(locale, 'tick', granularity).format(new Date(ms));
}

/** Читаемая метка времени точки графика (подсказка, таблица для скринридера). */
export function formatPointStamp(ms: number, locale: string, granularity: TickGranularity): string {
  return dtf(locale, 'stamp', granularity).format(new Date(ms));
}

const GOLD_RE = /^GOLD(\d+)$/;

/**
 * Локализованное название валюты: GOLD* — из переводов,
 * ISO-коды — через Intl.DisplayNames, фоллбэк — код как есть.
 */
export function currencyName(
  code: string,
  locale: string,
  goldLabel: (grams: string) => string,
): string {
  const gold = GOLD_RE.exec(code);
  if (gold) return goldLabel(gold[1]);
  try {
    const dn = new Intl.DisplayNames(
      [locale === 'kk' ? 'kk-KZ' : locale === 'en' ? 'en-US' : 'ru-RU'],
      { type: 'currency' },
    );
    const name = dn.of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

/** Класс flag-icons для кода валюты; золото и неизвестные — null (рендерится бейдж). */
export function currencyFlagClass(code: string): string | null {
  const map: Record<string, string> = {
    USD: 'us',
    EUR: 'eu',
    RUB: 'ru',
    CNY: 'cn',
    GBP: 'gb',
    AED: 'ae',
    TRY: 'tr',
    UZS: 'uz',
    KGS: 'kg',
    KZT: 'kz',
    THB: 'th',
    VND: 'vn',
    CAD: 'ca',
    CHF: 'ch',
    GEL: 'ge',
    INR: 'in',
    JPY: 'jp',
    AUD: 'au',
    KRW: 'kr',
    CZK: 'cz',
    UAH: 'ua',
  };
  return map[code] ?? null;
}

/** Символ валюты для подписи «Я получу ($)». */
export function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    USD: '$',
    EUR: '€',
    RUB: '₽',
    GBP: '£',
    KZT: '₸',
    CNY: '¥',
    JPY: '¥',
    TRY: '₺',
    THB: '฿',
    VND: '₫',
    KRW: '₩',
    INR: '₹',
    UAH: '₴',
  };
  return map[code] ?? code;
}
