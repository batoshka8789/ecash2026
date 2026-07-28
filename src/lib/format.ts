/** Форматирование чисел/дат по активной локали + названия валют. */

/**
 * Локаль приложения → BCP-47 для Intl. Единственный источник правды:
 * маппинг раньше был скопирован в четырёх местах, и добавление языка
 * означало, что где-то даты/валюты молча остались бы на русском.
 */
const INTL_LOCALES: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  kk: 'kk-KZ',
  zh: 'zh-CN',
};

export function intlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? INTL_LOCALES.ru;
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
    const dn = new Intl.DisplayNames([intlLocale(locale)], { type: 'currency' });
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

/**
 * Маска номера телефона — единый утверждённый формат проекта
 * «+7 (705) 908 90 73» (footer, ContactModal, формы авторизации).
 * Прогрессивно достраивает группы по мере ввода, не блочная маска
 * с прочерками — так поле не «прыгает» при удалении последней цифры.
 *
 * Код страны срезается ТОЛЬКО при ровно 11 цифрах (кто-то ввёл/вставил
 * с ведущей 7/8) — не по первой цифре: у казахстанских номеров код
 * оператора сам часто начинается на 7 (705, 707, 708…), и при проверке
 * "starts with 7" без учёта длины эта цифра терялась у любого номера
 * из 10 цифр, набранного с нуля.
 */
export function formatPhoneInput(raw: string): string {
  // Собственный префикс маски «+7» срезаем ДО извлечения цифр: контролируемый
  // input прогоняет уже отформатированное значение через маску заново на
  // каждом нажатии, и без этого «7» из префикса считалась цифрой номера —
  // в середине набора маска показывала «+7 (770) 5…» вместо «+7 (705…»
  // (самоисцелялось только на последней цифре).
  const body = raw.replace(/^\s*\+7\s*/, '');
  let digits = body.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);

  if (digits.length === 0) return '';
  let out = `+7 (${digits.slice(0, 3)}`;
  if (digits.length >= 3) out += ')';
  if (digits.length > 3) out += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += ` ${digits.slice(6, 8)}`;
  if (digits.length > 8) out += ` ${digits.slice(8, 10)}`;
  return out;
}

/**
 * Маска комбинированного поля входа «телефон или ИИН»: телефонный формат
 * подхватывается сразу (как везде на сайте), но ввод ИИН не ломается.
 *
 * Правила:
 * — начинается с «+» → однозначно телефон, обычная маска;
 * — до 10 цифр → телефонная маска БЕЗ отрезания лидирующей 7/8: ИИН
 *   1970–80-х годов рождения тоже начинается на 7/8, и «умное» отрезание
 *   кода страны безвозвратно съедало первую цифру ИИН;
 * — 11–12 цифр → без маски (это либо ИИН, либо полный номер с кодом
 *   страны — сервер нормализует сам, а цифры здесь не теряются).
 */
export function formatLoginInput(raw: string): string {
  // префикс собственной маски не считается цифрами номера (см. formatPhoneInput)
  const body = raw.replace(/^\s*\+7\s*/, '');
  const digits = body.replace(/\D/g, '').slice(0, 12);
  if (digits.length >= 11) return digits;

  if (digits.length === 0) return '';
  let out = `+7 (${digits.slice(0, 3)}`;
  if (digits.length >= 3) out += ')';
  if (digits.length > 3) out += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += ` ${digits.slice(6, 8)}`;
  if (digits.length > 8) out += ` ${digits.slice(8, 10)}`;
  return out;
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
