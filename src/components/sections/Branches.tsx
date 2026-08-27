'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Iconsax } from '@/components/ui/Iconsax';
import { Toast } from '@/components/ui/Toast';
import { BranchMap, type BranchMapMarker } from '@/components/ui/BranchMap';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { canonicalCity, formatBranchAddress, formatBranchTitle } from '@/lib/branch-address';
import { bestOffer, isBetterRate, type BranchRate } from '@/lib/best-offer';
import {
  almatyTime,
  badgeStyles,
  haversineKm,
  isHappyHours,
  isOpenNow,
  type BadgeKind,
  type GeoPoint,
} from '@/lib/branch-status';
import { currencySymbol, formatNumber } from '@/lib/format';
import { useUserPlace } from '@/lib/user-place';

/** Точка-разделитель между частями строки (Ellipse 4×4 в макете). */
function Dot() {
  return <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-current opacity-70" />;
}

/** Поисковая нормализация: регистр и «ё» не должны мешать найти отделение. */
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Курс в строке отделения: подпись сверху, значение снизу (14/400 + 18/400). */
function RateCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 lg:w-[154px] lg:px-5">
      <span className="text-sm leading-none text-text-disabled">{label}</span>
      <span className="text-lg leading-5 text-text-default">{value}</span>
    </div>
  );
}

/** Блок «Отделения Ecash»: переключатель Списком / На карте.
 *  Вид синхронизирован с URL (?view=map) — back/reload его сохраняют. */
export function Branches({ initialView = 'list' }: { initialView?: 'list' | 'map' }) {
  const t = useTranslations('locations');
  const tb = useTranslations('branches');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [view, setViewState] = useState<'list' | 'map'>(initialView);
  const [mapFull, setMapFull] = useState(false);
  const [userPos, setUserPos] = useState<GeoPoint | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeDepId, setActiveDepId] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<GeoPoint | undefined>(undefined);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [city, setCity] = useState<string | null>(null);

  const rowRefs = useRef(new Map<number, HTMLLIElement>());
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Валюта, с которой пришли из строки курсов («на карте» у строки) —
   *  прокидывается дальше в бронирование, чтобы флоу открылся с ней.
   *  Формат зажат ([A-Z0-9] до 8 символов, верхний регистр): значение из
   *  URL уходит обратно в query бронирования, и без проверки крафтовая
   *  ссылка ?currency=USD%26amount%3D… протаскивала бы лишние параметры. */
  const rawCurrency = searchParams.get('currency');
  const currency =
    rawCurrency && /^[a-z0-9]{1,8}$/i.test(rawCurrency) ? rawCurrency.toUpperCase() : null;

  /** Переключение вида: и state (мгновенно), и URL (история/шэринг).
   *  Остальные параметры (?currency, ?depId из карточки заявки…) сохраняем —
   *  раньше переключение вида затирало их из URL. */
  const setView = useCallback(
    (v: 'list' | 'map') => {
      setViewState(v);
      if (v !== 'map') setMapFull(false);
      const params = new URLSearchParams(searchParams);
      if (v === 'map') params.set('view', 'map');
      else params.delete('view');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Back/forward меняют searchParams — подтягиваем вид из URL
  // (паттерн «adjust state during render», без эффекта).
  const urlView: 'list' | 'map' = searchParams.get('view') === 'map' ? 'map' : 'list';
  const [prevUrlView, setPrevUrlView] = useState(urlView);
  if (urlView !== prevUrlView) {
    setPrevUrlView(urlView);
    setViewState(urlView);
    if (urlView !== 'map') setMapFull(false);
  }

  // ?depId= — переход «На карте» из карточки заявки/бронирования сразу
  // подсвечивает и открывает нужное отделение (координаты подгружаются
  // асинхронно, поэтому центрирование — эффектом ниже, после rows).
  // Предыдущее значение — null, а не текущее: иначе depId, пришедший уже в
  // первом рендере (прямая ссылка, перезагрузка, шэринг), не считался бы
  // изменением и карточка не открывалась.
  const urlDepId = Number(searchParams.get('depId')) || null;
  const [prevUrlDepId, setPrevUrlDepId] = useState<number | null>(null);
  if (urlDepId !== prevUrlDepId) {
    setPrevUrlDepId(urlDepId);
    if (urlDepId) setActiveDepId(urlDepId);
  }

  const list = useQuery({
    queryKey: ['departments'],
    queryFn: ({ signal }) => api.departments.list(signal),
    staleTime: 5 * 60_000,
  });

  // Карточки всех отделений (координаты, расписание, курсы) — одним ответом.
  // Ключ тот же, что у useBranchPoints, поэтому карта и список на одной
  // странице делят один запрос вместо шестнадцати на каждого.
  //
  // queryFn обязан вернуть РОВНО ту же форму, что и там: TanStack кеширует по
  // ключу, а не по функции, и распаковка здесь (`.then(r => r.departments)`)
  // означала бы, что содержимое кеша зависит от того, чей запрос выполнился
  // первым. Разворачиваем после, через select.
  const infos = useQuery({
    queryKey: ['departmentsDetails'],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => api.departments.details(signal),
    select: (r) => r.departments,
  });

  /** Валюта секции: из ?currency= (пришли из строки курсов), иначе USD. */
  const activeCurrency = currency ?? 'USD';

  // «Мой адрес» как запасная позиция: геолокацию давать не обязаны,
  // а сохранённый адрес у пользователя уже есть — от него и считаем
  // расстояния/«Рядом с вами», и его же показываем точкой на карте.
  const { coords: addressCoords } = useUserPlace();
  const effectivePos = userPos ?? addressCoords;

  // Геолокация: тихий отказ — подсказка в шапке, строки без расстояния.
  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      if (!cancelled) setGeoDenied(true);
    };
    if (!('geolocation' in navigator)) {
      const id = setTimeout(fail, 0);
      return () => {
        cancelled = true;
        clearTimeout(id);
      };
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      fail,
      { timeout: 10_000, maximumAge: 300_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Статус «Открыто/Закрыто» не протухает на долго открытой странице.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const rows = useMemo(() => {
    const deps = list.data?.departments ?? [];
    const infoById = new Map((infos.data ?? []).map((i) => [i.depId, i]));
    const hhmm = almatyTime.format(nowMs);
    /**
     * Лучшие курсы считаем САМИ из тех же buy/sell, которыми рисуются
     * колонки «Покупка»/«Продажа» ниже в этих же строках — расхождение
     * бейджа и цифры рядом с ним становится невозможным по построению.
     * Апстримный /rates/best для этого не годится: его bestBuy/bestSale
     * названы в семантике клиента, а не обменника, и бейдж вставал не на
     * ту строку (см. src/lib/best-offer.ts).
     *
     * Границы — текущий фильтр города: при «Все города» лучшее ищется по
     * всей сети, при выбранном городе — только среди его отделений.
     */
    const rateRows: BranchRate[] = deps.flatMap((dep) => {
      const info = infoById.get(dep.depId);
      const cur = info?.currencies.find((c) => c.code === activeCurrency);
      return cur
        ? [
            {
              depId: dep.depId,
              city: canonicalCity(info?.city),
              address: info?.address ?? dep.address,
              buy: cur.buy,
              sell: cur.sell,
            },
          ]
        : [];
    });
    // «Лучшая покупка» — колонка «Покупка»: обменник платит за валюту
    // больше всех (клиенту выгодно ПРОДАВАТЬ). «Лучшая продажа» — колонка
    // «Продажа»: обменник отдаёт валюту дешевле всех (выгодно ПОКУПАТЬ).
    const bestBuy = bestOffer(rateRows, 'selling', city);
    const bestSale = bestOffer(rateRows, 'buying', city);

    const items = deps.map((dep) => {
      const info = infoById.get(dep.depId);
      const coords = info?.coords ?? null;
      const cur = info?.currencies.find((c) => c.code === activeCurrency) ?? null;
      const timetable = info?.timetable ?? null;
      const rawAddress = info?.address ?? dep.address;
      const depCity = canonicalCity(info?.city);
      return {
        depId: dep.depId,
        title: formatBranchTitle(info?.name, info?.code ?? dep.code),
        // Адреса в API — «сырые» (капслок, страна и район); режем на отображении.
        address: formatBranchAddress(rawAddress, depCity),
        rawAddress,
        city: depCity,
        coords,
        distanceKm: effectivePos && coords ? haversineKm(effectivePos, coords) : null,
        rate: cur,
        timetable,
        open: timetable ? isOpenNow(timetable, hhmm) : null,
        badges: [] as BadgeKind[],
      };
    });

    // Это могут быть разные отделения (или одно и то же — тогда оба бейджа
    // у него), и подписи разные: иначе два одинаковых «Самый выгодный» на
    // экране было не различить, к какой колонке они относятся.
    //
    // Метим ВСЕ отделения с таким курсом, а не только то единственное,
    // что выбрал bestOffer как тай-брейк-победителя (при равных курсах он
    // произвольно берёт меньший depId — это нужно тизеру брони, чтобы
    // указывать на конкретный адрес, но здесь при ничьей бейдж доставался
    // только одному из них, и второе отделение с точно таким же лучшим
    // курсом оставалось вообще без бейджа). Сравниваем курсы напрямую:
    // «не хуже лучшего» — значит тоже лучший, сколько бы отделений его ни
    // делили. Отдельно проверяем город: bestOffer уже искал в его
    // границах, но items — по всей сети, и совпадение курса с отделением
    // другого города не должно давать ему чужой бейдж.
    const inScope = (depCity: string | null) => !city || depCity === city;
    for (const item of items) {
      if (!item.rate) continue;
      if (
        bestBuy &&
        item.rate.buy > 0 &&
        inScope(item.city) &&
        !isBetterRate('selling', bestBuy.rate, item.rate.buy)
      ) {
        item.badges.push('bestBuy');
      }
      if (
        bestSale &&
        item.rate.sell > 0 &&
        inScope(item.city) &&
        !isBetterRate('buying', bestSale.rate, item.rate.sell)
      ) {
        item.badges.push('bestSale');
      }
    }
    for (const item of items) {
      if (item.timetable && isHappyHours(item.timetable, hhmm)) item.badges.push('happyHours');
    }
    const withDistance = items.filter((i) => i.distanceKm != null);
    if (withDistance.length > 0) {
      const nearest = withDistance.reduce((a, b) =>
        (a.distanceKm ?? Infinity) <= (b.distanceKm ?? Infinity) ? a : b,
      );
      nearest.badges.push('nearest');
    }

    // С геолокацией — по расстоянию (без координат в конец), иначе — по depId.
    return items.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return a.depId - b.depId;
    });
  }, [list.data, infos.data, city, effectivePos, nowMs, activeCurrency]);

  const cities = useMemo(() => {
    const set = new Set(rows.map((r) => r.city).filter((c): c is string => Boolean(c)));
    // Алматы/Астана/Актобе — приоритетные города по требованию заказчика,
    // остальные — по алфавиту следом за ними.
    const priority = ['Алматы', 'Астана', 'Актобе'];
    return [...set].sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? priority.length : ai) - (bi === -1 ? priority.length : bi);
      }
      return a.localeCompare(b, locale);
    });
  }, [rows, locale]);

  // Поиск по адресу/названию и фильтр по городу сужают и список, и пины карты.
  const visibleRows = useMemo(() => {
    const q = norm(query.trim());
    return rows.filter((row) => {
      if (city && row.city !== city) return false;
      if (!q) return true;
      return (
        norm(row.address).includes(q) ||
        norm(row.rawAddress).includes(q) ||
        norm(row.title).includes(q) ||
        norm(row.city ?? '').includes(q)
      );
    });
  }, [rows, query, city]);

  const filtered = query.trim().length > 0 || city != null;
  const resetFilters = () => {
    setQuery('');
    setCity(null);
  };

  // Координаты отделения из ?depId= подгружаются асинхронно вместе с rows —
  // центрируем карту, как только они появятся (один раз на URL-переход;
  // adjust-during-render, без эффекта — rows уже доступны на момент рендера).
  const [centeredForDepId, setCenteredForDepId] = useState<number | null>(null);
  if (urlDepId && urlDepId !== centeredForDepId) {
    const coords = rows.find((r) => r.depId === urlDepId)?.coords;
    if (coords) {
      setCenteredForDepId(urlDepId);
      setMapCenter(coords);
    }
  }

  const markers = useMemo<BranchMapMarker[]>(
    () =>
      visibleRows.flatMap((row) =>
        row.coords
          ? [
              {
                id: row.depId,
                lat: row.coords.lat,
                lon: row.coords.lon,
                label: `${row.title} — ${row.address}`,
                active: row.depId === activeDepId,
                badge: row.badges[0]
                  ? { text: t(`badges.${row.badges[0]}`), tone: row.badges[0] }
                  : null,
              },
            ]
          : [],
      ),
    [visibleRows, activeDepId, t],
  );

  /**
   * Отделения сети разбросаны по Алматы и Астане: вписывание камеры во все
   * точки сразу даёт вид «весь Казахстан» с нечитаемыми пинами. Поэтому карта
   * открывается на городе пользователя (по ближайшему отделению), а без
   * геолокации — на самом крупном городе сети. Остальные пины остаются на
   * карте, до них можно доехать зумом или фильтром города.
   */
  const fitIds = useMemo(() => {
    const withCoords = visibleRows.filter((r) => r.coords && r.city);
    if (withCoords.length === 0) return undefined;

    const nearest = effectivePos
      ? withCoords.reduce((a, b) =>
          (a.distanceKm ?? Infinity) <= (b.distanceKm ?? Infinity) ? a : b,
        )
      : null;

    let target = nearest?.city ?? null;
    if (!target) {
      const counts = new Map<string, number>();
      for (const r of withCoords) counts.set(r.city!, (counts.get(r.city!) ?? 0) + 1);
      target = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }
    if (!target) return undefined;

    const ids = withCoords.filter((r) => r.city === target).map((r) => r.depId);
    return ids.length > 0 ? ids : undefined;
  }, [visibleRows, effectivePos]);

  const mapLabels = useMemo(
    () => ({
      zoomIn: t('zoomIn'),
      zoomOut: t('zoomOut'),
      myLocation: t('myLocation'),
      gestureHint: t('gestureHint'),
    }),
    [t],
  );

  // Возврат из карты в список — прокрутка к выбранному отделению.
  useEffect(() => {
    if (view !== 'list' || activeDepId == null) return;
    rowRefs.current.get(activeDepId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [view, activeDepId]);

  // Подсветка строки гаснет сама.
  useEffect(() => {
    if (view !== 'list' || activeDepId == null) return;
    const id = setTimeout(() => setActiveDepId(null), 4000);
    return () => clearTimeout(id);
  }, [view, activeDepId]);

  const copyAddress = async (depId: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(depId);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // clipboard недоступен (http, старый браузер) — молча
    }
  };

  const showOnMap = (depId: number, coords: GeoPoint | null) => {
    setActiveDepId(depId);
    if (coords) setMapCenter(coords);
    setView('map');
  };

  // Карточка выбранного отделения поверх карты (клик по пину / «На карте»).
  const mapSelected =
    view === 'map' && activeDepId != null
      ? (visibleRows.find((r) => r.depId === activeDepId) ?? null)
      : null;

  // Esc закрывает карточку на карте.
  useEffect(() => {
    if (!mapSelected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveDepId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mapSelected]);

  // Полноэкранная карта: Esc сворачивает (при открытой карточке Esc сначала
  // закрывает её), прокрутка страницы под оверлеем блокируется.
  useEffect(() => {
    if (!mapFull) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeDepId == null) setMapFull(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mapFull, activeDepId]);

  const loading = list.isPending || infos.isPending;
  const failed = list.isError || infos.isError;
  const retry = () => {
    if (list.isError) void list.refetch();
    if (infos.isError) void infos.refetch();
  };

  const rateOf = (row: (typeof rows)[number], kind: 'buy' | 'sell') =>
    row.rate ? formatNumber(row.rate[kind], locale, 2) : '—';

  const iconBtn =
    'inline-flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-surface-page-surf3 text-text-default transition-colors hover:bg-comp-surface2-hover';
  const outlineBtn =
    'inline-flex h-[46px] cursor-pointer items-center justify-center rounded-[20px] border border-stroke-brand px-6 text-sm font-medium text-text-brand transition-colors hover:bg-brand-hardsoft';

  return (
    <section className="container-page pt-8">
      <Toast
        open={copiedId != null}
        tone="positive"
        onClose={() => setCopiedId(null)}
        closeLabel={t('close')}
      >
        {tb('copied')}
      </Toast>

      <div className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 px-2 py-4 md:p-8">
        <div className="flex flex-col gap-3 px-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-0">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium leading-tight text-text-default md:text-[32px]">
              {t('title')}
            </h2>
            {!loading && !failed && (
              <p className="text-sm text-text-disabled">
                {t('found', { count: visibleRows.length })}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-1 rounded-3xl bg-surface-page-bg p-1">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={clsx(
                  'flex h-[50px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[20px] pl-4 pr-6 text-sm font-medium transition-colors md:flex-none',
                  view === v
                    ? 'bg-surface-page-surf1 text-text-default'
                    : 'text-text-default hover:bg-comp-surface1-hover',
                )}
              >
                <Icon name={v === 'list' ? 'list_alt' : 'map'} size={24} />
                {t(v === 'list' ? 'asList' : 'onMap')}
              </button>
            ))}
          </div>
        </div>

        <div className="my-8 h-px w-full bg-divider-hole md:my-10" />

        {failed ? (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="text-base text-text-default">{tb('loadError')}</p>
            <button type="button" onClick={retry} className={outlineBtn}>
              {tb('retry')}
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-1 lg:gap-8" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-[20px] bg-surface-page-surf2 p-4 md:px-6 md:pb-4 md:pt-6 lg:flex lg:items-center lg:gap-4 lg:bg-transparent lg:px-0 lg:pb-2 lg:pt-2"
              >
                <div className="flex flex-col gap-2 lg:grow">
                  <div className="h-4 w-48 animate-pulse rounded-md bg-surface-page-surf3" />
                  <div className="h-3 w-32 animate-pulse rounded-md bg-surface-page-surf3" />
                </div>
                <div className="mt-6 flex gap-6 lg:mt-0 lg:w-[308px] lg:shrink-0">
                  <div className="h-10 w-20 animate-pulse rounded-md bg-surface-page-surf3" />
                  <div className="h-10 w-20 animate-pulse rounded-md bg-surface-page-surf3" />
                </div>
                <div className="mt-6 flex items-center gap-2.5 lg:mt-0 lg:w-[228px] lg:shrink-0 lg:justify-end">
                  <div className="h-[46px] w-[46px] shrink-0 animate-pulse rounded-2xl bg-surface-page-surf3" />
                  <div className="h-[46px] grow animate-pulse rounded-[20px] bg-surface-page-surf3 lg:w-[152px] lg:grow-0" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {rows.length > 1 && (
              <div className="mb-6 flex flex-col gap-3 px-2 md:flex-row md:items-center md:px-0">
                <div className="relative flex min-w-0 grow items-center">
                  <Icon
                    name="search"
                    size={20}
                    className="pointer-events-none absolute left-4 text-text-disabled"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    aria-label={t('searchPlaceholder')}
                    className="h-11 w-full min-w-0 rounded-[20px] border border-stroke-surface1 bg-surface-page-bg pl-12 pr-12 text-sm text-text-default outline-none transition-colors placeholder:text-text-disabled focus:border-stroke-brand [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label={t('clearSearch')}
                      onClick={() => setQuery('')}
                      className="absolute right-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-text-disabled transition-colors hover:text-text-default"
                    >
                      <Icon name="close" size={18} />
                    </button>
                  )}
                </div>

                {cities.length > 1 && (
                  <div className="flex shrink-0 gap-1 overflow-x-auto rounded-3xl bg-surface-page-bg p-1">
                    {[null, ...cities].map((c) => (
                      <button
                        key={c ?? 'all'}
                        type="button"
                        onClick={() => setCity(c)}
                        aria-pressed={city === c}
                        className={clsx(
                          'h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-2xl px-4 text-sm font-medium transition-colors',
                          city === c
                            ? 'bg-surface-page-surf1 text-text-default'
                            : 'text-text-disabled hover:text-text-default',
                        )}
                      >
                        {c ?? t('allCities')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {geoDenied && (
              <p className="mb-4 px-2 text-sm text-text-disabled md:px-0">{tb('geoHint')}</p>
            )}

            {visibleRows.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-14 text-center">
                <Icon name="search_off" size={32} className="text-text-disabled" />
                <p className="text-base text-text-default">{t('nothingFound')}</p>
                {filtered && (
                  <button type="button" onClick={resetFilters} className={outlineBtn}>
                    {t('resetFilters')}
                  </button>
                )}
              </div>
            ) : view === 'list' ? (
              <ul className="flex flex-col gap-1 lg:gap-8">
                {visibleRows.map((row) => (
                  <li
                    key={row.depId}
                    ref={(el) => {
                      if (el) rowRefs.current.set(row.depId, el);
                      else rowRefs.current.delete(row.depId);
                    }}
                    className={clsx(
                      'rounded-[20px] bg-surface-page-surf2 p-4 transition-shadow md:px-6 md:pb-4 md:pt-6 lg:flex lg:items-center lg:bg-transparent lg:px-0 lg:pb-2 lg:pt-2',
                      activeDepId === row.depId &&
                        'ring-2 ring-stroke-brand lg:ring-offset-4 lg:ring-offset-surface-page-surf1',
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-6 md:flex-row md:items-center md:gap-4 lg:grow">
                      <div className="flex min-w-0 grow flex-col justify-end gap-2">
                        {row.badges.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {row.badges.map((badge) => (
                              <span
                                key={badge}
                                className={clsx(
                                  'rounded-lg px-2 text-xs font-bold leading-[18px] text-text-always-white',
                                  badgeStyles[badge],
                                )}
                              >
                                {t(`badges.${badge}`)}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-default md:text-base">
                          <Icon
                            name="account_balance"
                            size={20}
                            className="shrink-0 text-text-default"
                          />
                          <span>{row.title}</span>
                          {row.city && (
                            <>
                              <Dot />
                              <span>{row.city}</span>
                            </>
                          )}
                          {row.timetable && (
                            <>
                              <Dot />
                              <span className="whitespace-nowrap">
                                {row.timetable.openTime} - {row.timetable.closeTime}
                              </span>
                              <Dot />
                              <span>{row.open ? tb('open') : tb('closed')}</span>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-disabled">
                          <span className="min-w-0 break-words" title={row.rawAddress}>
                            {row.address}
                          </span>
                          {row.distanceKm != null && (
                            <>
                              <Dot />
                              <span className="whitespace-nowrap">
                                {formatNumber(row.distanceKm, locale, 1)} {tb('km')}
                              </span>
                            </>
                          )}
                          <button
                            type="button"
                            aria-label={tb('copy')}
                            onClick={() =>
                              copyAddress(
                                row.depId,
                                row.city ? `${row.city}, ${row.address}` : row.address,
                              )
                            }
                            className="-my-2.5 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-disabled transition-colors hover:text-text-default"
                          >
                            <Iconsax name="copy" size={20} />
                          </button>
                        </div>
                      </div>

                      <div className="-mx-3 flex shrink-0 items-center md:mx-0 lg:w-[308px]">
                        <RateCell label={`${t('buyLabel')} (${currencySymbol(activeCurrency)})`} value={rateOf(row, 'buy')} />
                        <RateCell label={`${t('sellLabel')} (${currencySymbol(activeCurrency)})`} value={rateOf(row, 'sell')} />
                      </div>
                    </div>

                    <div className="mt-6 flex items-center gap-2.5 lg:mt-0 lg:w-[228px] lg:shrink-0 lg:justify-end lg:pl-5">
                      <button
                        type="button"
                        aria-label={t('showOnMap')}
                        title={t('showOnMap')}
                        onClick={() => showOnMap(row.depId, row.coords)}
                        className={clsx(iconBtn, 'order-2 md:order-1')}
                      >
                        <Iconsax name="map" size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/booking?depId=${row.depId}${currency ? `&to=${encodeURIComponent(currency)}` : ''}`,
                          )
                        }
                        className={clsx(
                          outlineBtn,
                          'order-1 grow md:order-2 lg:w-[152px] lg:grow-0',
                        )}
                      >
                        {t('book')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              // Разворот через fixed-оверлей, а не браузерный Fullscreen API —
              // тот конфликтует с модалками; ResizeObserver в BranchMap сам
              // вызывает map.resize() при смене размеров контейнера.
              <div
                className={clsx(
                  'overflow-hidden',
                  mapFull ? 'fixed inset-0 z-50 bg-surface-page-bg' : 'relative rounded-[20px]',
                )}
              >
                <BranchMap
                  markers={markers}
                  fitIds={fitIds}
                  center={mapCenter}
                  userPos={effectivePos}
                  controls
                  cooperative={!mapFull}
                  onMarkerClick={(id) => {
                    setActiveDepId(id);
                    const hit = visibleRows.find((r) => r.depId === id);
                    if (hit?.coords) setMapCenter(hit.coords);
                  }}
                  onBackgroundClick={() => setActiveDepId(null)}
                  label={t('title')}
                  emptyText={t('nothingFound')}
                  unavailableText={t('mapUnavailable')}
                  labels={mapLabels}
                  /* до 768 кнопка «Развернуть на весь экран» (низ по центру,
                     из макета) наезжала на пилюлю провайдера — поднимаем её */
                  providerClassName="max-md:bottom-[72px]"
                  className={mapFull ? 'h-full' : 'h-[420px] md:h-[517px] lg:h-[717px]'}
                />

                <button
                  type="button"
                  onClick={() => setMapFull((v) => !v)}
                  className={clsx(
                    // whitespace-nowrap: «Развернуть на весь экран» на 375px
                    // переносилась на две строки и вылезала из h-11
                    'absolute bottom-4 left-1/2 z-10 inline-flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[20px] bg-surface-inverted pl-4 pr-6 text-sm font-medium text-text-inverted shadow-lg transition-opacity hover:opacity-90 md:h-[38px]',
                    mapSelected && 'max-md:hidden',
                  )}
                >
                  <Icon name={mapFull ? 'close_fullscreen' : 'open_in_full'} size={20} />
                  {mapFull ? t('fullscreenExit') : t('fullscreen')}
                </button>

                {/* Виджет отделения поверх карты — фрейм «map card» макета.
                    На мобильных макет показывает его шторкой на затемнении
                    (Rectangle 567, чёрный 60%): иначе низ карточки перекрывает
                    липкий баннер приложения. С 768 — плавающая карточка слева. */}
                {mapSelected && (
                  <>
                    <button
                      type="button"
                      aria-label={t('closeCard')}
                      onClick={() => setActiveDepId(null)}
                      className="fixed inset-0 z-[45] cursor-default bg-scrim md:hidden"
                    />
                    <div
                      role="dialog"
                      aria-label={mapSelected.title}
                      className="fixed inset-x-0 bottom-0 z-50 max-h-[85%] overflow-y-auto rounded-t-[32px] border-2 border-b-0 border-stroke-brand bg-surface-page-surf1 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 shadow-[0_16px_40px_rgb(0_0_0/0.45)] md:absolute md:inset-x-auto md:bottom-auto md:left-6 md:top-6 md:z-20 md:w-[360px] md:rounded-[32px] md:border-b-2 md:pb-6"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-bold leading-tight text-text-default">
                          {mapSelected.title}
                        </h3>
                        <button
                          type="button"
                          aria-label={t('closeCard')}
                          onClick={() => setActiveDepId(null)}
                          className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-disabled transition-colors hover:bg-comp-surface2-hover hover:text-text-default"
                        >
                          <Icon name="close" size={22} />
                        </button>
                      </div>

                      {mapSelected.badges.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {mapSelected.badges.map((badge) => (
                            <span
                              key={badge}
                              className={clsx(
                                'rounded-lg px-2 text-xs font-bold leading-[18px] text-text-always-white',
                                badgeStyles[badge],
                              )}
                            >
                              {t(`badges.${badge}`)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex flex-col gap-2 text-sm text-text-disabled">
                        <span className="flex items-start gap-2">
                          <Iconsax name="location" size={16} className="mt-0.5 shrink-0" />
                          <span className="min-w-0 break-words" title={mapSelected.rawAddress}>
                            {mapSelected.city ? `${mapSelected.city}, ` : ''}
                            {mapSelected.address}
                            {mapSelected.distanceKm != null &&
                              ` · ${formatNumber(mapSelected.distanceKm, locale, 1)} ${tb('km')}`}
                          </span>
                        </span>
                        {mapSelected.timetable && (
                          <span className="flex items-center gap-2">
                            <Iconsax name="clock" size={16} className="shrink-0" />
                            <span className="whitespace-nowrap">
                              {mapSelected.timetable.openTime} - {mapSelected.timetable.closeTime}
                            </span>
                            <Dot />
                            <span
                              className={
                                mapSelected.open ? 'text-text-positive' : 'text-text-negative'
                              }
                            >
                              {mapSelected.open ? tb('open') : tb('closed')}
                            </span>
                          </span>
                        )}
                      </div>

                      {mapSelected.rate && (
                        <div className="mt-4 flex items-stretch rounded-2xl border border-stroke-surface3 px-2.5 py-1.5">
                          <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
                            <span className="text-xs font-medium text-text-disabled">
                              {`${t('buyLabel')} (${currencySymbol(activeCurrency)})`}
                            </span>
                            <span className="text-lg font-bold leading-tight text-text-default">
                              {rateOf(mapSelected, 'buy')} {currencySymbol('KZT')}
                            </span>
                          </div>
                          <div aria-hidden className="w-px shrink-0 bg-stroke-surface3" />
                          <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
                            <span className="text-xs font-medium text-text-disabled">
                              {`${t('sellLabel')} (${currencySymbol(activeCurrency)})`}
                            </span>
                            <span className="text-lg font-bold leading-tight text-text-default">
                              {rateOf(mapSelected, 'sell')} {currencySymbol('KZT')}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/booking?depId=${mapSelected.depId}${currency ? `&to=${encodeURIComponent(currency)}` : ''}`,
                            )
                          }
                          className="inline-flex h-[46px] grow cursor-pointer items-center justify-center rounded-[20px] bg-btn-brand px-6 text-sm font-medium text-text-always-white transition-[filter] hover:brightness-110"
                        >
                          {t('book')}
                        </button>
                        {mapSelected.coords && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${mapSelected.coords.lat},${mapSelected.coords.lon}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={t('route')}
                            title={t('route')}
                            className={iconBtn}
                          >
                            <Iconsax name="routing-2" size={20} />
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
