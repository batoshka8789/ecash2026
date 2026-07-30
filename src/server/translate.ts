import 'server-only';
import { env } from './env';
import { chunkLines, chunkText, splitChunkResult, type Line } from '@/lib/translate-chunk';
import {
  docTextLeaves,
  parseStoredBody,
  serializeDoc,
  withTranslatedLeaves,
} from '@/lib/richtext-doc';
import type { Locale } from '@/lib/domain';

/**
 * Машинный перевод новостей. Ходит наружу только сервер: ключей у переводчика
 * нет, но и адрес стенда светить браузером посетителя незачем.
 *
 * Нарезка под лимит запроса — в lib/translate-chunk.ts, там же тесты. Здесь
 * сеть (очередь запросов, лимиты, разбор ответа) и сборка вокруг неё:
 * переводится либо простое поле (заголовок, анонс), либо текстовые листья
 * JSON-документа тела новости (lib/richtext-doc.ts) — структура и марки
 * переводчику не передаются и им не рискуют.
 */

const ENDPOINT = 'https://api.mymemory.translated.net/get';
const TIMEOUT_MS = 15_000;
/** Больше — переводчик начинает отвечать отказом по частоте. */
const GAP_MS = 120;

/** Коды языков у переводчика: китайский только с указанием региона. */
const LANG: Record<Locale, string> = { ru: 'ru', en: 'en', kk: 'kk', zh: 'zh-CN' };

export class TranslateError extends Error {
  constructor(
    /** ключ сообщения из messages.errors.* */
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = 'TranslateError';
  }
}

type MyMemoryResponse = {
  responseStatus?: number | string;
  responseData?: { translatedText?: string };
  responseDetails?: string;
};

/** Ответ приходит с HTML-сущностями (&quot;, &#39;) — возвращаем символы. */
function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

async function requestOne(text: string, from: Locale, to: Locale, signal?: AbortSignal): Promise<string> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${LANG[from]}|${LANG[to]}`);
  if (env.TRANSLATE_EMAIL) url.searchParams.set('de', env.TRANSLATE_EMAIL);

  // собственный таймаут поверх переданного сигнала: висящий внешний сервис
  // не должен держать наш запрос до победного
  const timer = AbortSignal.timeout(TIMEOUT_MS);
  const abort = signal ? AbortSignal.any([signal, timer]) : timer;

  let res: Response;
  try {
    res = await fetch(url, { signal: abort, headers: { accept: 'application/json' } });
  } catch {
    throw new TranslateError('errors.translateUnavailable', 503);
  }

  if (!res.ok) throw new TranslateError('errors.translateUnavailable', 503);

  const data = (await res.json().catch(() => null)) as MyMemoryResponse | null;
  const status = Number(data?.responseStatus);
  const out = data?.responseData?.translatedText;

  if (status === 429 || /LIMIT/i.test(data?.responseDetails ?? '')) {
    throw new TranslateError('errors.translateQuota', 429);
  }
  if (status !== 200 || typeof out !== 'string' || !out.trim()) {
    throw new TranslateError('errors.translateUnavailable', 502);
  }

  return decodeEntities(out);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Переводит обычный текст (заголовок, анонс). Длинный режется на куски по
 * границе предложения и склеивается обратно.
 */
export async function translatePlain(
  text: string,
  from: Locale,
  to: Locale,
  signal?: AbortSignal,
): Promise<string> {
  const parts = chunkText(text);
  if (!parts.length) return '';

  const out: string[] = [];
  for (const [i, part] of parts.entries()) {
    if (i) await wait(GAP_MS);
    out.push(await requestOne(part, from, to, signal));
  }
  return out.join(' ');
}

/**
 * Переводит список строк по позициям — общая механика для translateDoc.
 *
 * Строки идут порциями по несколько штук за запрос — переносы строк перевод
 * переживают. Если порция вернулась с другим числом строк, разложить её
 * обратно нельзя, и тогда эти строки переводятся поодиночке: медленнее, зато
 * ничего не съезжает по позициям.
 */
async function translateLines(lines: Line[], from: Locale, to: Locale, signal?: AbortSignal): Promise<string[]> {
  const chunks = chunkLines(lines);
  const translated: string[] = lines.map((l) => l.text);
  if (!chunks.length) return translated;

  let first = true;
  for (const chunk of chunks) {
    if (!first) await wait(GAP_MS);
    first = false;

    const answer = await requestOne(chunk.query, from, to, signal);
    const parts = splitChunkResult(chunk, answer);

    if (parts) {
      chunk.indices.forEach((lineIndex, i) => {
        translated[lineIndex] = parts[i].trim();
      });
      continue;
    }

    // запасной путь: построчно
    for (const lineIndex of chunk.indices) {
      await wait(GAP_MS);
      translated[lineIndex] = (await requestOne(lines[lineIndex].text, from, to, signal)).trim();
    }
  }

  return translated;
}

/**
 * Переводит тело новости (JSON-документ редактора), сохраняя структуру.
 * Переводчику уходит только плоский список текста листьев — типы узлов,
 * марки (жирный/цвет/шрифт/ссылка) и их атрибуты не покидают сервер и не
 * могут быть испорчены ответом переводчика.
 */
export async function translateDoc(source: string, from: Locale, to: Locale, signal?: AbortSignal): Promise<string> {
  const doc = parseStoredBody(source);
  const leaves = docTextLeaves(doc);
  if (!leaves.length) return source;

  const translated = await translateLines(
    leaves.map((text) => ({ text })),
    from,
    to,
    signal,
  );
  return serializeDoc(withTranslatedLeaves(doc, translated));
}

export type TranslatableFields = { title: string; excerpt: string; body: string };

/** Переводит все поля новости на один язык. */
export async function translateNews(
  fields: TranslatableFields,
  from: Locale,
  to: Locale,
  signal?: AbortSignal,
): Promise<TranslatableFields> {
  const title = await translatePlain(fields.title, from, to, signal);
  await wait(GAP_MS);
  const excerpt = fields.excerpt ? await translatePlain(fields.excerpt, from, to, signal) : '';
  if (fields.excerpt) await wait(GAP_MS);
  const body = await translateDoc(fields.body, from, to, signal);
  return { title, excerpt, body };
}
