import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Чистая логика автоперевода: какие языки догонять. Сеть и БД сюда не
 * входят (ensure/sweep — интеграционные, их поведение собрано из этих
 * решений + translateNews, у которого свои тесты нарезки).
 */

let mod: typeof import('./news-autotranslate');

beforeAll(async () => {
  process.env.ECASH_API_BASE_URL = 'https://api-dev.quiq.kz';
  process.env.ECASH_CLIENT_ID = 'test';
  process.env.ECASH_CLIENT_SECRET = 'test';
  process.env.SESSION_SECRET = Buffer.from(new Uint8Array(32).fill(7)).toString('base64');
  process.env.DATABASE_URL = 'postgres://test';
  process.env.APP_ORIGIN = 'http://localhost:3000';
  mod = await import('./news-autotranslate');
});

const ru = { title: 'Заголовок', excerpt: 'Анонс', body: '{"type":"doc"}' };

describe('localesToTranslate', () => {
  it('без русского переводить не из чего', () => {
    expect(mod.localesToTranslate({})).toEqual([]);
  });

  it('только русский → нужны все три языка', () => {
    expect(mod.localesToTranslate({ ru })).toEqual(['en', 'kk', 'zh']);
  });

  it('ручной перевод (без auto) не трогается', () => {
    const translations = {
      ru,
      en: { title: 'Manual', excerpt: '', body: '{}' },
    };
    expect(mod.localesToTranslate(translations)).toEqual(['kk', 'zh']);
  });

  it('свежий авто-перевод не перегенерируется', () => {
    const hash = mod.sourceHash(ru);
    const translations = {
      ru,
      en: { title: 'Auto', excerpt: '', body: '{}', auto: hash },
      kk: { title: 'Авто', excerpt: '', body: '{}', auto: hash },
      zh: { title: '自动', excerpt: '', body: '{}', auto: hash },
    };
    expect(mod.localesToTranslate(translations)).toEqual([]);
  });

  it('русский изменился → авто-переводы устарели и перегенерируются, ручной — нет', () => {
    const staleHash = mod.sourceHash({ ...ru, title: 'Старый заголовок' });
    const translations = {
      ru,
      en: { title: 'Auto', excerpt: '', body: '{}', auto: staleHash },
      kk: { title: 'Қолмен', excerpt: '', body: '{}' }, // ручной
      zh: { title: '自动', excerpt: '', body: '{}', auto: staleHash },
    };
    expect(mod.localesToTranslate(translations)).toEqual(['en', 'zh']);
  });
});

describe('sourceHash', () => {
  it('стабилен для одинакового текста и различает разный', () => {
    expect(mod.sourceHash(ru)).toBe(mod.sourceHash({ ...ru }));
    expect(mod.sourceHash(ru)).not.toBe(mod.sourceHash({ ...ru, body: '{"x":1}' }));
    // поля не склеиваются в неоднозначную строку: перенос границы меняет хэш
    expect(mod.sourceHash({ title: 'ab', excerpt: 'c', body: '' })).not.toBe(
      mod.sourceHash({ title: 'a', excerpt: 'bc', body: '' }),
    );
  });
});
