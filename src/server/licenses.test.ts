import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LICENSE_CITIES, LICENSES_DIR } from '@/lib/licenses';
import { hasLicenseFile, licenseFilePath } from './licenses';

const ALL = LICENSE_CITIES.flatMap((c) => c.licenses);
const DIR = path.join(process.cwd(), 'public', ...LICENSES_DIR.split('/'));

/** Отделения, по которым лицензию нам ещё не передали (на 26.08.2026). */
const AWAITING_PDF: string[] = [];

describe('каталог лицензий', () => {
  it('не содержит двух записей на один файл', () => {
    const files = ALL.map((l) => l.file);
    expect(new Set(files).size).toBe(files.length);
  });

  /**
   * Главная страховка на будущее: PDF докладывают в каталог руками, и
   * опечатка в имени («License_AsiaPark.pdf» вместо
   * «License_Asia_Park_Astana.pdf») ничего не сломала бы — файл просто
   * лежал бы мёртвым грузом, а плитка осталась серой. Здесь это падение.
   */
  it('на каждый PDF в public/documents/licenses есть запись', () => {
    const onDisk = readdirSync(DIR).filter((f) => f.endsWith('.pdf'));
    const known = new Set(ALL.map((l) => l.file));
    expect(onDisk.filter((f) => !known.has(f))).toEqual([]);
  });

  it('уже переданные лицензии видны как файлы', () => {
    const khanshatyr = ALL.find((l) => l.file === 'License_Khanshatyr_Astana.pdf');
    expect(khanshatyr && hasLicenseFile(khanshatyr)).toBe(true);
    expect(licenseFilePath({ name: 'x', file: 'y.pdf' })).toBe(path.join(DIR, 'y.pdf'));
  });

  /**
   * Проверка односторонняя: положить недостающий PDF тест не должен
   * ронять — иначе «просто добавь файл» перестаёт быть просто. Падает
   * обратное: файла не стало у отделения, которое его уже имело.
   */
  it('без файла остаются только отделения, по которым PDF не передали', () => {
    const pending = ALL.filter((l) => !hasLicenseFile(l)).map((l) => l.file);
    expect(AWAITING_PDF).toEqual(expect.arrayContaining(pending));
  });
});
