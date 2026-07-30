import { describe, expect, it } from 'vitest';
import { chunkLines, chunkText, splitChunkResult, type Line } from './translate-chunk';

const lines = (...texts: string[]): Line[] => texts.map((text) => ({ text }));

describe('chunkLines', () => {
  it('складывает короткие строки в одну порцию', () => {
    const chunks = chunkLines(lines('раз', 'два', 'три'));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].query).toBe('раз\nдва\nтри');
    expect(chunks[0].indices).toEqual([0, 1, 2]);
  });

  it('не превышает лимит', () => {
    const long = lines(...Array.from({ length: 10 }, (_, i) => `строка ${i} `.repeat(6)));
    const chunks = chunkLines(long, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // одиночная строка длиннее лимита едет как есть — на неё правило не распространяется
      if (c.indices.length > 1) expect(c.query.length).toBeLessThanOrEqual(100);
    }
  });

  it('пустые строки в порции не попадают', () => {
    const chunks = chunkLines(lines('раз', '', '', 'два'));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].indices).toEqual([0, 3]);
  });

  it('на пустом списке порций нет', () => {
    expect(chunkLines(lines('', ''))).toEqual([]);
  });

  it('слишком длинная строка едет отдельной порцией', () => {
    const chunks = chunkLines(lines('я'.repeat(200), 'коротко'), 100);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].indices).toEqual([0]);
  });
});

describe('splitChunkResult', () => {
  const chunk = { indices: [0, 1], query: 'раз\nдва' };

  it('раскладывает ответ по строкам', () => {
    expect(splitChunkResult(chunk, 'one\ntwo')).toEqual(['one', 'two']);
  });

  it('при несовпадении числа строк отдаёт null — вызывающий переведёт поодиночке', () => {
    expect(splitChunkResult(chunk, 'one two')).toBeNull();
    expect(splitChunkResult(chunk, 'one\ntwo\nthree')).toBeNull();
  });
});

describe('chunkText', () => {
  it('короткий текст не режет', () => {
    expect(chunkText('Заголовок')).toEqual(['Заголовок']);
  });

  it('пустой текст даёт пустой список', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('режет по границе предложения', () => {
    const text = `${'а'.repeat(40)}. ${'б'.repeat(40)}. ${'в'.repeat(40)}`;
    const parts = chunkText(text, 50);
    expect(parts[0].endsWith('.')).toBe(true);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(50);
  });

  it('текст без пробелов режется жёстко, но не теряется', () => {
    const parts = chunkText('я'.repeat(120), 50);
    expect(parts.join('')).toHaveLength(120);
  });
});
