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
 * Часть отделений на старом сайте есть, а PDF по ним нам не передали
 * (ASIA PARK, EURASIA, ARUJAN, АЭРОПОРТ). Строки для них здесь всё же
 * есть: список должен совпадать со старым сайтом, иначе человек ищет
 * знакомое отделение и решает, что оно закрылось. Такая строка выводится
 * неактивной плиткой с подписью «скоро» — кликнуть по ней нельзя.
 *
 * ДОБАВИТЬ НЕДОСТАЮЩИЙ PDF: положить файл в public/documents/licenses под
 * именем, указанным в поле `file` этой записи, — и всё. Кода менять не
 * нужно: страница спрашивает у диска, есть ли файл (src/server/licenses.ts),
 * и сама превращает плитку в рабочую ссылку при следующей сборке. Если имя
 * файла удобнее другое — поменять `file` здесь на фактическое имя. Тест
 * src/server/licenses.test.ts ловит расхождение: лишний PDF в каталоге,
 * на который не ссылается ни одна запись, роняет прогон.
 */

export type License = {
  /** Имя документа, как в списке на сайте */
  name: string;
  /** Файл в public/documents/licenses */
  file: string;
};

export type LicenseCity = {
  /** Ключ подписи города в messages (`documents.cities.*`) */
  key: 'almaty' | 'astana';
  licenses: License[];
};

/** Каталог PDF внутри public — один на все ссылки страницы. */
export const LICENSES_DIR = '/documents/licenses';

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
      { name: 'ДОКУМЕНТЫ ECASH АСТАНИНСКИЙ ФИЛИАЛ - EURASIA', file: 'License_Eurasia_Astana.pdf' },
      { name: 'ДОКУМЕНТЫ ECASH АСТАНИНСКИЙ ФИЛИАЛ - ARUJAN', file: 'License_Arujan_Astana.pdf' },
      { name: 'ДОКУМЕНТЫ TANDAU EXCHANGE - ABU DHABI', file: 'License_Abu_Dhabi_Astana.pdf' },
      {
        name: 'ДОКУМЕНТЫ ECASH АСТАНИНСКИЙ ФИЛИАЛ - АЭРОПОРТ',
        file: 'License_Aeroport_Astana.pdf',
      },
    ],
  },
];
