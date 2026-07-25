/**
 * Читаемый адрес отделения из «сырой» строки Ecash API.
 *
 * Бэкенд отдаёт адреса в том виде, в каком их завели операторы: страна,
 * область и район, капслок, разный порядок маркеров улицы («ул. ПРОСПЕКТ
 * ДОСТЫК», «Проспект Қабанбай Батыр», «УЛИЦА КАБДОЛОВА ул.»), номер дома то
 * через «д.», то через «дом №», то просто числом. В макете адрес выглядит как
 * «пр. Достык, 240» — одна короткая строка, поэтому мусор режется здесь,
 * на слое отображения (данные в API не меняем).
 *
 * Разбор пословный, а не по запятым: запятые в исходных строках стоят
 * непредсказуемо («Казахстан, Алматинская обл. г. Алматы ул. ПРОСПЕКТ ДОСТЫК
 * д. 89»). Если ничего распознать не удалось, возвращается исходная строка —
 * лучше длинный адрес, чем пустой.
 */

/** Города присутствия: в адресе они шум, город показывается отдельным полем. */
const CITY_WORDS = new Set([
  'алматы',
  'астана',
  'шымкент',
  'караганда',
  'нур-султан',
  'almaty',
  'astana',
  'shymkent',
]);

/** Тип улицы → каноничное сокращение. «пр.» приоритетнее «ул.». */
const STREET_TYPES = new Map<string, string>([
  ['проспект', 'пр.'],
  ['пр', 'пр.'],
  ['пр-т', 'пр.'],
  ['улица', 'ул.'],
  ['ул', 'ул.'],
  ['шоссе', 'шоссе'],
  ['бульвар', 'бул.'],
  ['бул', 'бул.'],
  ['переулок', 'пер.'],
  ['пер', 'пер.'],
]);

/** Населённый пункт внутри области — значимая часть адреса, не шум. */
const LOCALITY_TYPES = new Map<string, string>([
  ['с', 'с.'],
  ['село', 'с.'],
  ['пос', 'пос.'],
  ['поселок', 'пос.'],
  ['посёлок', 'пос.'],
  ['аул', 'аул'],
  ['мкр', 'мкр'],
  ['микрорайон', 'мкр'],
]);

/** Маркеры номера дома: следующее число — номер. */
const HOUSE_MARKERS = new Set(['д', 'дом', 'уч', 'участок', '№', '#']);

/** Уточнения после номера дома — сохраняются отдельными сегментами. */
const EXTRA_MARKERS = new Map<string, string>([
  ['кв', 'кв.'],
  ['квартира', 'кв.'],
  ['офис', 'офис'],
  ['оф', 'офис'],
  ['этаж', 'этаж'],
  ['строение', 'строение'],
  ['стр', 'строение'],
  ['корпус', 'корпус'],
  ['блок', 'блок'],
]);

const NUMBER_RE = /^\d+([/\-]\d+[а-яёa-z]?)?[а-яёa-z]?$/iu;

/** Капслок → «Достык»; аббревиатуры (ТЦ, БЦ) и смешанный регистр не трогаем. */
function normalizeCase(word: string): string {
  if (word.length <= 3) return word;
  if (word !== word.toUpperCase()) return word;
  return word[0] + word.slice(1).toLowerCase();
}

/** Слово без завершающей точки и в нижнем регистре — ключ для словарей. */
function key(word: string): string {
  return word.toLowerCase().replace(/\.+$/, '');
}

export function formatBranchAddress(raw: string | null | undefined, city?: string | null): string {
  const cleaned = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  // Уточнения в скобках вынимаем целиком: внутри бывают запятые,
  // которые сбили бы разбор («(мясной отдел 595, 1 этаж)»).
  const tails: string[] = [];
  const body = cleaned.replace(/\(([^)]*)\)/g, (_full, inner: string) => {
    const text = inner.trim();
    if (text) tails.push(text);
    return ' ';
  });

  const words = body.split(/[\s,;]+/).filter(Boolean);
  const cityKey = city ? city.trim().toLowerCase() : null;

  let locality: string | null = null;
  let streetType: string | null = null;
  const street: string[] = [];
  let house: string | null = null;
  const extras: string[] = [];

  let pendingHouse = false;
  let pendingLocality: string | null = null;
  let pendingExtra: string | null = null;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const k = key(word);
    const nextKey = i + 1 < words.length ? key(words[i + 1]) : '';

    // Ожидание аргумента у маркера, увиденного на прошлой итерации.
    if (pendingLocality) {
      locality = `${pendingLocality} ${normalizeCase(word)}`;
      pendingLocality = null;
      continue;
    }
    if (pendingExtra) {
      if (k === '№' || k === '#') continue;
      extras.push(`${pendingExtra} ${normalizeCase(word)}`);
      pendingExtra = null;
      continue;
    }
    if (pendingHouse) {
      if (k === '№' || k === '#') continue;
      house = normalizeCase(word);
      pendingHouse = false;
      continue;
    }

    // Страна и служебные префиксы.
    if (k === 'казахстан' || k === 'республика' || k === 'рк' || k === 'kazakhstan') continue;
    // «Алматинская обл.» / «АЛМАТЫ обл.» — вместе с предшествующим прилагательным.
    if (k === 'обл' || k === 'область' || k === 'облысы') {
      street.pop();
      continue;
    }
    // «Медеуский р-он» / «РАЙОН ЕСИЛЬ» / «Есильский район».
    if (k === 'р-он' || k === 'р-н' || k === 'рн' || k === 'ауданы') {
      street.pop();
      continue;
    }
    if (k === 'район') {
      if (street.length > 0) street.pop();
      else i++; // «РАЙОН ЕСИЛЬ» — имя района идёт следующим
      continue;
    }
    // «г. Алматы», «Г.АСТАНА», «АСТАНА г.», «АСТАНА Қ.».
    if (k === 'г' || k === 'город' || k === 'қ' || k === 'каласы' || k === 'қаласы') {
      if (CITY_WORDS.has(nextKey) || (cityKey && nextKey === cityKey)) i++;
      continue;
    }
    if (/^г\.[\p{L}]+$/u.test(k)) continue;
    if (CITY_WORDS.has(k) || (cityKey && k === cityKey)) {
      // «АСТАНА г.» — маркер города стоит после названия.
      if (nextKey === 'г' || nextKey === 'қ') {
        i++;
        continue;
      }
      // Одиночное имя города до улицы — тоже шум.
      if (street.length === 0 && !locality) continue;
    }

    const localityType = LOCALITY_TYPES.get(k);
    if (localityType && !locality && street.length === 0) {
      pendingLocality = localityType;
      continue;
    }

    const type = STREET_TYPES.get(k);
    if (type) {
      // «ул. ПРОСПЕКТ ДОСТЫК»: проспект уточняет тип, улица — нет.
      if (!streetType || type === 'пр.') streetType = type;
      continue;
    }

    if (HOUSE_MARKERS.has(k)) {
      pendingHouse = true;
      continue;
    }

    const extra = EXTRA_MARKERS.get(k);
    if (extra) {
      pendingExtra = extra;
      continue;
    }

    // Одиночное число после названия улицы — номер дома.
    if (NUMBER_RE.test(word) && street.length > 0 && !house) {
      house = word;
      continue;
    }

    street.push(normalizeCase(word));
  }

  const streetPhrase = [streetType, ...street].filter(Boolean).join(' ');
  const parts = [locality, streetPhrase, house, ...extras].filter((part): part is string =>
    Boolean(part && part.trim()),
  );
  let result = parts.join(', ');
  if (tails.length > 0) result = `${result} (${tails.join('; ')})`.trim();

  return result.trim() || cleaned;
}

/** Один и тот же город в API приходит и латиницей, и кириллицей. */
const CITY_CANON = new Map<string, string>([
  ['almaty', 'Алматы'],
  ['алматы', 'Алматы'],
  ['astana', 'Астана'],
  ['астана', 'Астана'],
  ['nur-sultan', 'Астана'],
  ['нур-султан', 'Астана'],
  ['shymkent', 'Шымкент'],
  ['шымкент', 'Шымкент'],
]);

/**
 * Каноничное написание города: без него «Almaty» и «Алматы» из одного и того
 * же API становятся двумя разными городами в фильтре.
 */
export function canonicalCity(city: string | null | undefined): string | null {
  const trimmed = (city ?? '').trim();
  if (!trimmed) return null;
  return CITY_CANON.get(trimmed.toLowerCase()) ?? trimmed;
}

/**
 * Заголовок отделения как в макете («Ecash Достык»): человеческое имя точки
 * из `code`, а если оно уже начинается с бренда или пусто — `name` как есть.
 */
export function formatBranchTitle(
  name: string | null | undefined,
  code: string | null | undefined,
): string {
  const trimmedCode = (code ?? '').trim();
  const trimmedName = (name ?? '').trim();
  if (trimmedCode) {
    if (/^ecash/i.test(trimmedCode)) return `Ecash${trimmedCode.slice(5)}`;
    return `Ecash ${trimmedCode}`;
  }
  return trimmedName || 'Ecash';
}
