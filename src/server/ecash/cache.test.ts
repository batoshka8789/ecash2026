import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedUpstream, resetUpstreamCache } from './cache';

/**
 * Свойства, ради которых кеш существует: один апстрим-запрос на окно TTL,
 * коалесинг одновременных промахов, stale-on-error при падении апстрима.
 */

beforeEach(() => {
  vi.useFakeTimers();
  resetUpstreamCache();
});
afterEach(() => vi.useRealTimers());

describe('cachedUpstream', () => {
  it('в окне TTL апстрим вызывается один раз', async () => {
    const fn = vi.fn().mockResolvedValue('a');
    expect(await cachedUpstream('k', 1000, fn)).toBe('a');
    expect(await cachedUpstream('k', 1000, fn)).toBe('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('после истечения TTL — новый запрос', async () => {
    const fn = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    expect(await cachedUpstream('k', 1000, fn)).toBe('a');
    vi.advanceTimersByTime(1001);
    expect(await cachedUpstream('k', 1000, fn)).toBe('b');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('одновременные промахи ждут ОДИН общий запрос (коалесинг)', async () => {
    let resolve!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const p1 = cachedUpstream('k', 1000, fn);
    const p2 = cachedUpstream('k', 1000, fn);
    resolve('a');
    expect(await p1).toBe('a');
    expect(await p2).toBe('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('апстрим упал, протухшее значение есть — отдаём его (stale-on-error)', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce('a')
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce('c');
    expect(await cachedUpstream('k', 1000, fn)).toBe('a');
    vi.advanceTimersByTime(1001);
    // падение → старое значение вместо ошибки
    expect(await cachedUpstream('k', 1000, fn)).toBe('a');
    // апстрим ожил → свежее значение
    expect(await cachedUpstream('k', 1000, fn)).toBe('c');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('апстрим упал и кеша нет — ошибка пробрасывается', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    await expect(cachedUpstream('k', 1000, fn)).rejects.toThrow('down');
    // неудача не кешируется — следующий вызов пробует снова
    await expect(cachedUpstream('k', 1000, fn)).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('ключи независимы', async () => {
    const fn = vi.fn().mockImplementation((k: string) => Promise.resolve(k));
    expect(await cachedUpstream('a', 1000, () => fn('a'))).toBe('a');
    expect(await cachedUpstream('b', 1000, () => fn('b'))).toBe('b');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
