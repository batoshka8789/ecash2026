/**
 * Диагностический след запроса к ядру Ecash.
 *
 * Обычный лог (`logCall`) отвечает на вопрос «какой метод сколько отвечал»,
 * а при разборе дефектов на стороне Ecash нужен другой ответ: ЧТО ИМЕННО мы
 * отправили и ЧТО ИМЕННО они вернули. Пересказ своими словами их команду не
 * устраивает и не должен — нужен буквальный JSON.
 *
 * Поэтому у методов брони след включён всегда (это открытый блокер, см.
 * HANDOFF §9.0), а всему остальному его можно включить `ECASH_TRACE=true`.
 *
 * Что в лог НЕ попадает: пароли, коды, токены — вырезаны навсегда; ФИО,
 * телефон, ИИН, почта — заменены меткой, чтобы структура запроса осталась
 * видна, а персональные данные не оседали в логах стенда. На
 * воспроизводимость это не влияет: ни один известный дефект ядра от этих
 * значений не зависит.
 */

/** Секреты: значение не должно попасть в лог ни при каких условиях. */
const SECRET_KEYS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'oldPassword',
  'otp',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
]);

/** Персональные данные: ключ показываем, значение — нет. */
const PII_KEYS = new Set(['fullName', 'phoneNumber', 'phone', 'iin', 'email']);

const SECRET_MASK = '«секрет»';
const PII_MASK = '«ПДн»';

/** Длиннее этого ответы обрезаем: списки операций занимают экраны. */
const MAX_BODY_CHARS = 2000;

/** Рекурсивно заменяет секреты и ПДн, сохраняя форму объекта. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.has(key)
        ? SECRET_MASK
        : PII_KEYS.has(key)
          ? PII_MASK
          : redact(val);
    }
    return out;
  }
  return value;
}

const clip = (s: string) =>
  s.length > MAX_BODY_CHARS ? `${s.slice(0, MAX_BODY_CHARS)}… (обрезано, всего ${s.length})` : s;

/** Экранирование для одинарных кавычек shell: 'O'\''Brien'. */
const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export type TraceInput = {
  method: string;
  /** полный URL, как он ушёл в fetch */
  url: string;
  /** тело запроса ДО сериализации; undefined — тела не было */
  body?: unknown;
  /** уходил ли Bearer-токен (сам токен в лог не пишем) */
  withToken: boolean;
  status: number;
  ms: number;
  /** сырой текст ответа */
  responseText: string;
  /** код ошибки, если ответ неуспешный */
  errCode?: string;
};

/**
 * Собирает след одним блоком: запрос, ответ и готовая команда curl.
 *
 * Всё возвращается ОДНОЙ строкой намеренно — параллельные запросы к ядру
 * идут постоянно, и построчный вывод перемешал бы чужой ответ с нашим
 * запросом. Читать такой лог невозможно, а именно его и показывают Ecash.
 */
export function formatTrace(t: TraceInput): string {
  const bodyJson = t.body === undefined ? null : JSON.stringify(redact(t.body));
  const ok = t.status >= 200 && t.status < 300;
  const verdict = ok ? `${t.status} OK` : `${t.status} ${t.errCode ?? 'ошибка'}`;

  const lines = [
    `[ecash:trace] ${t.method} ${t.url}`,
    bodyJson ? `  отправлено: ${bodyJson}` : '  отправлено: (без тела)',
    `  ответ ${verdict} за ${t.ms} мс`,
    `  тело ответа: ${t.responseText ? clip(t.responseText) : '(пусто)'}`,
  ];

  // Команда для их разработчиков: скопировать и выполнить у себя.
  const curl = [
    'curl -sS -i',
    `-X ${t.method}`,
    shellQuote(t.url),
    ...(bodyJson ? ["-H 'content-type: application/json'"] : []),
    ...(t.withToken ? ["-H 'authorization: Bearer <ТОКЕН>'"] : []),
    ...(bodyJson ? [`-d ${shellQuote(bodyJson)}`] : []),
  ].join(' ');
  lines.push(`  воспроизвести: ${curl}`);

  return lines.join('\n');
}
