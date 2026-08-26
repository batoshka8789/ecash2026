/**
 * Лицензии Нацбанка РК по отделениям — данные страницы /documents-license.
 *
 * Названия документов и их порядок перенесены 1:1 с раздела «Документы»
 * действующего сайта: человек ищет знакомую строку глазами, а не по
 * алфавиту, и любая пересортировка ломает эту привычку. Отсюда и
 * «АПОРТ» перед «АПОРТ2», и Abu Dhabi шестым в Астане.
 *
 * Названия НЕ переводятся ни на одну локаль: это имена самих документов
 * (юридические лица «Ecash 2», «Сарыарка Exchange», «Tandau Exchange»),
 * а не подписи интерфейса — переведённое имя перестало бы совпадать с
 * тем, что человек увидит внутри PDF. Переводится только обвязка
 * страницы (заголовки, города) — namespace `documents` в messages.
 *
 * Если по какому-то отделению PDF ещё не передали, строка для него всё
 * равно должна остаться в списке: человек ищет знакомое название и по
 * его отсутствию решил бы, что отделение закрылось. Такая строка
 * выводится неактивной плиткой с подписью «скоро» — кликнуть по ней
 * нельзя (см. hasLicenseFile в src/server/licenses.ts).
 *
 * ДОБАВИТЬ НЕДОСТАЮЩИЙ PDF: положить файл в public/Licenses под именем,
 * указанным в поле `file` этой записи, — и всё. Кода менять не нужно:
 * страница спрашивает у диска, есть ли файл (src/server/licenses.ts), и
 * сама превращает плитку в рабочую ссылку при следующей сборке. Если имя
 * файла удобнее другое — поменять `file` здесь на фактическое имя. Тест
 * src/server/licenses.test.ts ловит расхождение: лишний PDF в каталоге,
 * на который не ссылается ни одна запись, роняет прогон.
 */

export type License = {
  /** Имя документа, как в списке на сайте */
  name: string;
  /** Файл в public/Licenses */
  file: string;
};

export type LicenseCity = {
  /** Ключ подписи города в messages (`documents.cities.*`) */
  key: 'almaty' | 'astana' | 'aktobe';
  licenses: License[];
};

/**
 * Каталог PDF внутри public — один на все ссылки страницы. С большой
 * буквы и без сегмента /documents: заказчик хочет именно такой публичный
 * путь у ссылок на лицензии — /Licenses/<file>, а не /documents/licenses/<file>.
 */
export const LICENSES_DIR = '/Licenses';

export const licenseHref = (l: License) => `${LICENSES_DIR}/${l.file}`;

export const LICENSE_CITIES: LicenseCity[] = [
  {
    key: 'almaty',
    licenses: [
      { name: 'ДОКУМЕНТЫ ECASH 2 - ГРАНД ПАРК', file: 'License_Grandpark_Almaty.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH 5 - АПОРТ', file: 'License_Aport_Almaty.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH 6 - FORUM', file: 'License_Forum_Almaty.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH - ЗЕЛЕНЫЙ БАЗАР', file: 'License_Zelenyi_Bazar_Almaty.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH 7 - MEGA PARK', file: 'License_Mega_Park_Almaty.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH 5 - АПОРТ2', file: 'License_Aport2_Almaty.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH KAZAKHSTAN - ALMATY MALL', file: 'License_Almaty_Mall_Almaty.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH KAZAKHSTAN - РИТЦ-ПАЛАС', file: 'License_Ritc_Palace_Almaty.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH KAZAKHSTAN - СПУТНИК', file: 'License_Sputnik_Almaty.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH - RIXOS', file: 'License_Rixos_Almaty.pdf' },
    ],
  },
  {
    key: 'astana',
    licenses: [
      { name: 'ДОКУМЕНТЫ ECASH 3 - ХАНШАТЫР', file: 'License_Khanshatyr_Astana.pdf' },
      { name: 'ДОКУМЕНТЫ САРЫАРКА EXCHANGE - САРЫАРКА', file: 'License_Saryarka_Astana.pdf' },
      {
        name: 'ДОКУМЕНТЫ ECASH АСТАНИНСКИЙ ФИЛИАЛ - ASIA PARK',
        file: 'License_Asia_Park_Astana.pdf',
      },
      {
        name: 'ДОКУМЕНТЫ ECASH АСТАНИНСКИЙ ФИЛИАЛ - EURASIA-3',
        file: 'License_Eurasia3_Astana.pdf',
      },
      { name: 'ДОКУМЕНТЫ ECASH АСТАНИНСКИЙ ФИЛИАЛ - ARUZHAN', file: 'License_Aruzhan_Astana.pdf' },
      { name: 'ДОКУМЕНТЫ TANDAU EXCHANGE - ABU DHABI', file: 'License_Abu_Dhabi_Astana.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH 4 - АЭРОПОРТ', file: 'License_Aeroport_Astana.pdf' },
    ],
  },
  {
    key: 'aktobe',
    licenses: [{ name: 'ДОКУМЕНТЫ E-EXCHANGE - АКТОБЕ', file: 'License_Aktobe_Aktobe.pdf' }],
  },
];
