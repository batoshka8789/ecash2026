import { describe, expect, it } from 'vitest';
import { canonicalCity, formatBranchAddress, formatBranchTitle } from './branch-address';

/** Строки — реальные адреса отделений из api-dev.quiq.kz (18 отделений). */
describe('formatBranchAddress', () => {
  it('режет страну, область, район и город', () => {
    expect(formatBranchAddress('КАЗАХСТАН, НҰРА р-он, АСТАНА г., ПРОСПЕКТ ТҰРАН ул., д. 37,')).toBe(
      'пр. Тұран, 37',
    );
    expect(
      formatBranchAddress('РЕСПУБЛИКА КАЗАХСТАН, АСТАНА Қ., РАЙОН ЕСИЛЬ, КАБАНБАЙ БАТЫР, 119'),
    ).toBe('Кабанбай Батыр, 119');
    expect(
      formatBranchAddress('РЕСПУБЛИКА КАЗАХСТАН,  Г.АСТАНА, Проспект Қабанбай Батыр, дом № 62'),
    ).toBe('пр. Қабанбай Батыр, 62');
  });

  it('приводит «ул. ПРОСПЕКТ X» к «пр. X» и выносит номер дома', () => {
    expect(formatBranchAddress('г. Алматы ул. Проспект СЕЙФУЛЛИНА д. 617')).toBe(
      'пр. Сейфуллина, 617',
    );
    expect(
      formatBranchAddress('АЛМАТЫ обл., АУЭЗОВСКИЙ р-он, УЛИЦА КАБДОЛОВА ул., строение 1/4'),
    ).toBe('ул. Кабдолова, строение 1/4');
  });

  it('сохраняет уточнения в скобках и квартиру/офис', () => {
    expect(
      formatBranchAddress(
        'Казахстан, г. Алматы, Медеуский р-он, пр. Жибек Жолы 53 (мясной отдел 595, 1 этаж)',
      ),
    ).toBe('пр. Жибек Жолы, 53 (мясной отдел 595, 1 этаж)');
    expect(formatBranchAddress('Казахстан, г. Алматы, ул. Наурызбай батыра, дом 50, кв. 163')).toBe(
      'ул. Наурызбай батыра, 50, кв. 163',
    );
    expect(
      formatBranchAddress(
        'Казахстан, Алматинская обл. г. Алматы ул. ПРОСПЕКТ ДОСТЫК д. 89 кв. (офис) 71',
      ),
    ).toBe('пр. Достык, 89, кв. 71 (офис)');
  });

  it('сохраняет населённый пункт вне города', () => {
    expect(
      formatBranchAddress(
        'Алматинская обл. Карасайский р-он с. ИРГЕЛИ ул. Трасса АЛМАТЫ БИШКЕК д. 767',
      ),
    ).toBe('с. Иргели, ул. Трасса Алматы Бишкек, 767');
  });

  it('не ломает короткие адреса и аббревиатуры', () => {
    expect(formatBranchAddress('ТЦ Сарыарка')).toBe('ТЦ Сарыарка');
    expect(formatBranchAddress('ECASH Asia Park')).toBe('Ecash Asia Park');
    expect(formatBranchAddress('Аль Фараби 34')).toBe('Аль Фараби, 34');
    expect(formatBranchAddress(' Для проверки лимитов')).toBe('Для проверки лимитов');
    expect(formatBranchAddress('test')).toBe('test');
  });

  it('возвращает исходную строку, когда распознать нечего', () => {
    expect(formatBranchAddress('Казахстан')).toBe('Казахстан');
    expect(formatBranchAddress('')).toBe('');
    expect(formatBranchAddress(null)).toBe('');
  });

  it('режет город из поля city, даже если его нет в списке', () => {
    expect(formatBranchAddress('Костанай, ул. Тәуелсіздік, д. 10', 'Костанай')).toBe(
      'ул. Тәуелсіздік, 10',
    );
  });
});

describe('canonicalCity', () => {
  it('сводит латиницу и кириллицу к одному городу', () => {
    expect(canonicalCity('Almaty')).toBe('Алматы');
    expect(canonicalCity(' алматы ')).toBe('Алматы');
    expect(canonicalCity('Astana')).toBe('Астана');
    expect(canonicalCity('Нур-Султан')).toBe('Астана');
  });

  it('незнакомый город оставляет как есть, пустой — null', () => {
    expect(canonicalCity('Костанай')).toBe('Костанай');
    expect(canonicalCity('')).toBe(null);
    expect(canonicalCity(null)).toBe(null);
  });
});

describe('formatBranchTitle', () => {
  it('подставляет бренд к человеческому имени точки', () => {
    expect(formatBranchTitle('Ecash 8', 'Mega Silk Way')).toBe('Ecash Mega Silk Way');
    expect(formatBranchTitle('Сарыарка Exchange', 'Сарыарка')).toBe('Ecash Сарыарка');
  });

  it('не дублирует бренд', () => {
    expect(formatBranchTitle('Ecash 34', 'Ecash 34')).toBe('Ecash 34');
    expect(formatBranchTitle('DEV TEST SANDBOX', 'ECASH 3')).toBe('Ecash 3');
  });

  it('падает обратно на name и на бренд', () => {
    expect(formatBranchTitle('Франшизы', '')).toBe('Франшизы');
    expect(formatBranchTitle(null, null)).toBe('Ecash');
  });
});
