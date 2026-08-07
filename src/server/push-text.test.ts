import { describe, expect, it } from 'vitest';
import {
  alertBodyMany,
  alertBodyOne,
  alertTitle,
  toPushLocale,
  welcomeText,
  type PushLocale,
} from './push-text';

const LOCALES: PushLocale[] = ['ru', 'en', 'kk', 'zh'];

describe('toPushLocale', () => {
  it('пропускает известные языки', () => {
    for (const l of LOCALES) expect(toPushLocale(l)).toBe(l);
  });

  it('всё неизвестное сводит к русскому', () => {
    // в колонке БД лежит обычный text — туда может попасть что угодно
    expect(toPushLocale('de')).toBe('ru');
    expect(toPushLocale('')).toBe('ru');
    expect(toPushLocale(null)).toBe('ru');
    expect(toPushLocale(undefined)).toBe('ru');
  });
});

describe('тексты заполнены на всех языках', () => {
  it('приветствие', () => {
    for (const l of LOCALES) {
      expect(welcomeText[l].title.trim()).not.toBe('');
      expect(welcomeText[l].body.trim()).not.toBe('');
    }
  });

  it('заголовок сработавшей подписки', () => {
    for (const l of LOCALES) expect(alertTitle[l].trim()).not.toBe('');
  });

  it('языки не дублируют друг друга — значит перевод действительно сделан', () => {
    const titles = new Set(LOCALES.map((l) => alertTitle[l]));
    expect(titles.size).toBe(LOCALES.length);
  });
});

describe('alertBodyOne', () => {
  it('содержит код валюты и курс на каждом языке', () => {
    for (const l of LOCALES) {
      const s = alertBodyOne(l, 'USD', 507, 'buy');
      expect(s).toContain('USD');
      expect(s).toContain('507');
    }
  });

  it('покупка и продажа звучат по-разному', () => {
    for (const l of LOCALES) {
      expect(alertBodyOne(l, 'USD', 507, 'buy')).not.toBe(alertBodyOne(l, 'USD', 507, 'sell'));
    }
  });

  it('копейки сохраняются, хвост нулей — нет', () => {
    expect(alertBodyOne('en', 'EUR', 542.5, 'buy')).toContain('542.5');
    expect(alertBodyOne('en', 'EUR', 542.0, 'buy')).toContain('542');
    expect(alertBodyOne('en', 'EUR', 542.0, 'buy')).not.toContain('542.0');
  });
});

describe('alertBodyMany', () => {
  it('перечисляет все валюты', () => {
    for (const l of LOCALES) {
      const s = alertBodyMany(l, ['USD', 'EUR']);
      expect(s).toContain('USD');
      expect(s).toContain('EUR');
    }
  });
});
