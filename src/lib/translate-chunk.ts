/**
 * Порционная нарезка текста под лимит запроса переводчика.
 *
 * Строки уходят в один запрос через перевод строки (`\n`) — переводчик
 * (MyMemory) эмпирически подтверждённо сохраняет переносы строк, поэтому
 * несколько коротких значений можно перевести одним вызовом, а не по одному.
 * Порция всегда кончается на границе строки, чтобы ответ можно было
 * разложить обратно один-в-один по позициям.
 *
 * Что именно является «строкой» — решает вызывающий код: server/translate.ts
 * использует это и для листьев JSON-документа новости (см. lib/richtext-doc.ts
 * docTextLeaves/withTranslatedLeaves), и для одиночных полей вроде заголовка.
 * Здесь нет ничего специфичного для формата документа — чистая логика без
 * сети, сетевой вызов живёт в server/translate.ts.
 */

/** Жёсткий предел запроса у переводчика — 500 символов, берём с запасом. */
export const CHUNK_LIMIT = 460;

export type Line = { text: string };

export type Chunk = {
  /** номера строк, попавшие в эту порцию, по порядку */
  indices: number[];
  /** склеенный текст для одного запроса */
  query: string;
};

/**
 * Режет строки на порции под лимит запроса. Порция всегда кончается на
 * границе строки: так ответ можно разложить обратно по строкам.
 *
 * Пустые строки в порции не участвуют — переводить нечего. Строка длиннее
 * лимита уезжает в собственную порцию — переводчик обрежет её сам, но
 * остальной текст от этого не пострадает.
 */
export function chunkLines(lines: Line[], limit = CHUNK_LIMIT): Chunk[] {
  const chunks: Chunk[] = [];
  let indices: number[] = [];
  let length = 0;

  const flush = () => {
    if (!indices.length) return;
    chunks.push({ indices, query: indices.map((i) => lines[i].text).join('\n') });
    indices = [];
    length = 0;
  };

  lines.forEach((line, i) => {
    if (!line.text) return;
    // +1 на перевод строки между склеенными строками
    const cost = line.text.length + (indices.length ? 1 : 0);
    if (indices.length && length + cost > limit) flush();
    indices.push(i);
    length += cost;
  });

  flush();
  return chunks;
}

/**
 * Раскладывает ответ порции обратно по строкам. Если переводчик вернул не
 * столько строк, сколько отправляли, разложить нечего — возвращаем null,
 * и вызывающий переводит эти строки поодиночке.
 */
export function splitChunkResult(chunk: Chunk, result: string): string[] | null {
  const parts = result.split('\n');
  return parts.length === chunk.indices.length ? parts : null;
}

/** Режет одиночную строку (заголовок, анонс) на куски под лимит запроса. */
export function chunkText(text: string, limit = CHUNK_LIMIT): string[] {
  const value = String(text ?? '').trim();
  if (value.length <= limit) return value ? [value] : [];

  const out: string[] = [];
  let rest = value;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    // режем по концу предложения, иначе по пробелу, иначе жёстко
    const dot = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
    const space = window.lastIndexOf(' ');
    const cut = dot > limit * 0.5 ? dot + 1 : space > limit * 0.5 ? space : limit;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}
