import 'server-only';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { LICENSES_DIR, type License } from '@/lib/licenses';

/**
 * Есть ли на диске PDF лицензии — единственный признак «ссылка рабочая».
 *
 * Часть отделений в каталоге стоит без файла: PDF по ним нам ещё не
 * передали. Держать это вторым полем (`pending: true`) значило бы завести
 * состояние, которое в день появления файла обязательно забудут снять —
 * и строка так и осталась бы серой при живом PDF. Поэтому спрашиваем сам
 * каталог public/Licenses: файл с ожидаемым именем появился —
 * плитка на /documents-license становится ссылкой, без правок кода.
 *
 * Проверка синхронная и на диск ходит только при рендере страницы: та
 * статическая (SSG), в проде это происходит на сборке. Значит новый PDF
 * оживает после пересборки образа, а не по подкладыванию файла в
 * работающий контейнер — public там из образа.
 */
export function licenseFilePath(license: License): string {
  return path.join(process.cwd(), 'public', ...LICENSES_DIR.split('/'), license.file);
}

export function hasLicenseFile(license: License): boolean {
  return existsSync(licenseFilePath(license));
}
