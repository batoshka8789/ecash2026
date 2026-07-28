'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Toast } from '@/components/ui/Toast';
import { BranchMap, type BranchMapMarker } from '@/components/ui/BranchMap';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { canonicalCity, formatBranchAddress, formatBranchTitle } from '@/lib/branch-address';
import { currencySymbol, formatNumber } from '@/lib/format';

/** Бейджи отделения: цвета из палитры макета (badge, 12/700, r8). */
const badgeStyles = {
  best: 'bg-brand',
  happyHours: 'bg-additional-2',
  nearest: 'bg-additional-3',
} as const;

type BadgeKind = keyof typeof badgeStyles;

type GeoPoint = { lat: number; lon: number };

/** Расстояние по большому кругу, км. */
function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Текущее время HH:mm в часовом поясе отделений (Asia/Almaty). */
const almatyTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Almaty',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Открыто ли по расписанию: строки HH:mm сравниваются лексикографически;
 *  closeTime '23:59' означает «до полуночи», open > close — ночной график. */
function isOpenNow(tt: { openTime: string; closeTime: string }, hhmm: string): boolean {
  if (tt.openTime <= tt.closeTime) return hhmm >= tt.openTime && hhmm <= tt.closeTime;
  return hhmm >= tt.openTime || hhmm <= tt.closeTime;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** «Happy hours» — последние 2 часа перед закрытием, пока отделение открыто:
 *  вечернее окно, когда обменники традиционно дают выгодный курс постоянным
 *  клиентам. Ночной график (open > close) учитывается через модуль суток.
 *  Это фронтовый дефолт до появления признака от бэкенда. */
function isHappyHours(tt: { openTime: string; closeTime: string }, hhmm: string): boolean {
  if (!isOpenNow(tt, hhmm)) return false;
  const minutesToClose = (toMinutes(tt.closeTime) - toMinutes(hhmm) + 1440) % 1440;
  return minutesToClose <= 120;
}

/** Ниже 768 макет показывает карту полноэкранным оверлеем («header» 480×840 на
 *  экранах 1355:88222 / 1355:88730), а не врезкой внутри карточки отделений.
 *  На сервере ширины нет — снапшот false, врезка. */
const NARROW_MQ = '(width < 48rem)';
const subscribeNarrow = (onChange: () => void) => {
  const mq = window.matchMedia(NARROW_MQ);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
const getNarrow = () => window.matchMedia(NARROW_MQ).matches;

/** Точка-разделитель между частями строки (Ellipse 4×4 в макете, заливка без альфы). */
function Dot() {
  return <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-current" />;
}

/** Курс в строке отделения: подпись сверху, значение снизу (14/400 + 18/400).
 *  Код валюты в подписи макет показывает только до 1024 («Покупка ($)»),
 *  на 1024/1920 подпись короткая («Покупка»). */
function RateCell({
  label,
  labelNarrow,
  value,
}: {
  label: string;
  labelNarrow: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 md:w-[154px] md:px-5">
      <span className="text-sm leading-[1.1] text-text-disabled">
        <span className="lg:hidden">{labelNarrow}</span>
        <span className="max-lg:hidden">{label}</span>
      </span>
      <span className="text-lg leading-5 text-text-default">{value}</span>
    </div>
  );
}

/** Блок «Отделения Ecash»: переключатель Списком / На карте.
 *  Вид синхронизирован с URL (?view=map) — back/reload его сохраняют. */
export function Branches({ initialView = 'list' }: { initialView?: 'list' | 'map' }) {
  const t = useTranslations('locations');
  const tb = useTranslations('branches');
  // Короткие подписи курса («Покупка» / «Продажа») из макета: отдельных ключей
  // в locations нет, берём готовые из home.rates.
  const tr = useTranslations('home.rates');
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
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, () => false);

  const rowRefs = useRef(new Map<number, HTMLLIElement>());
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Переключение вида: и state (мгновенно), и URL (история/шэринг). */
  const setView = useCallback(
    (v: 'list' | 'map') => {
      setViewState(v);
      if (v !== 'map') setMapFull(false);
      router.replace(v === 'map' ? `${pathname}?view=map` : pathname, { scroll: false });
    },
    [router, pathname],
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

  const depIds = useMemo(() => list.data?.departments.map((d) => d.depId) ?? [], [list.data]);

  // Детали всех отделений (координаты, расписание, курсы) — одним запросом-обёрткой.
  const infos = useQuery({
    queryKey: ['departmentsInfo', depIds],
    enabled: depIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) =>
      Promise.all(depIds.map((id) => api.departments.info(id, signal).then((r) => r.department))),
  });

  // Лучший курс USD по сети — бейдж «Самый выгодный»; ошибка не критична.
  const best = useQuery({
    queryKey: ['rates', 'best', 'USD'],
    queryFn: ({ signal }) => api.rates.best('USD', undefined, signal),
    staleTime: 5 * 60_000,
  });

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
    const bestBuyDepId = best.data?.best.bestBuy?.depId ?? null;

    const items = deps.map((dep) => {
      const info = infoById.get(dep.depId);
      const coords = info?.coords ?? null;
      const usd = info?.currencies.find((c) => c.code === 'USD') ?? null;
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
        distanceKm: userPos && coords ? haversineKm(userPos, coords) : null,
        usd,
        timetable,
        open: timetable ? isOpenNow(timetable, hhmm) : null,
        badges: [] as BadgeKind[],
      };
    });

    // Порядок бейджей по макету (1279:108407 / 1279:108798): выгодный →
    // ближайший → happy hours.
    if (bestBuyDepId != null) {
      const hit = items.find((i) => i.depId === bestBuyDepId);
      if (hit) hit.badges.push('best');
    }
    const withDistance = items.filter((i) => i.distanceKm != null);
    if (withDistance.length > 0) {
      const nearest = withDistance.reduce((a, b) =>
        (a.distanceKm ?? Infinity) <= (b.distanceKm ?? Infinity) ? a : b,
      );
      nearest.badges.push('nearest');
    }
    for (const item of items) {
      if (item.timetable && isHappyHours(item.timetable, hhmm)) item.badges.push('happyHours');
    }

    // С геолокацией — по расстоянию (без координат в конец), иначе — по depId.
    return items.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return a.depId - b.depId;
    });
  }, [list.data, infos.data, best.data, userPos, nowMs]);

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
      rows.flatMap((row) =>
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
    [rows, activeDepId, t],
  );

  /**
   * Отделения сети разбросаны по Алматы и Астане: вписывание камеры во все
   * точки сразу даёт вид «весь Казахстан» с нечитаемыми пинами. Поэтому карта
   * открывается на городе пользователя (по ближайшему отделению), а без
   * геолокации — на самом крупном городе сети. Остальные пины остаются на
   * карте, до них можно доехать зумом или фильтром города.
   */
  const fitIds = useMemo(() => {
    const withCoords = rows.filter((r) => r.coords && r.city);
    if (withCoords.length === 0) return undefined;

    const nearest = userPos
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
  }, [rows, userPos]);

  const mapLabels = useMemo(() => ({ gestureHint: t('gestureHint') }), [t]);

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
      ? (rows.find((r) => r.depId === activeDepId) ?? null)
      : null;

  /** Карта во весь экран: ниже 768 — всегда (так её показывает макет),
   *  выше — по кнопке разворота. */
  const mapOverlay = view === 'map' && (mapFull || narrow);

  /** Крестик оверлея: с широкого экрана возвращает во врезку, с узкого —
   *  в список, как «close» на мобильных экранах макета. */
  const closeMap = () => {
    if (mapFull) setMapFull(false);
    else setView('list');
  };

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
    if (!mapOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || activeDepId != null) return;
      if (mapFull) setMapFull(false);
      else setView('list');
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mapOverlay, mapFull, activeDepId, setView]);

  const loading = list.isPending || (depIds.length > 0 && infos.isPending);
  const failed = list.isError || infos.isError;
  const retry = () => {
    if (list.isError) void list.refetch();
    if (infos.isError) void infos.refetch();
  };

  const rateOf = (row: (typeof rows)[number], kind: 'buy' | 'sell') =>
    row.usd ? formatNumber(row.usd[kind], locale, 2) : '—';

  const iconBtn =
    'inline-flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-surface-page-surf3 text-text-default transition-colors hover:bg-comp-surface2-hover';
  const outlineBtn =
    'inline-flex h-[46px] cursor-pointer items-center justify-center rounded-[20px] border border-stroke-brand px-6 text-sm font-medium text-text-brand transition-colors hover:bg-brand-hardsoft';

  return (
    <section className="container-page bleed-mobile pt-6">
      <Toast
        open={copiedId != null}
        tone="positive"
        onClose={() => setCopiedId(null)}
        closeLabel={t('close')}
      >
        {tb('copied')}
      </Toast>

      <div className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 px-2 py-4 md:p-8">
        {/* Шапка блока: заголовок прижат к верху строки таббара (58px).
            До 768 фрейм заголовка в макете фиксированной высоты 29. */}
        <div className="flex flex-col gap-3 px-2 md:flex-row md:items-start md:justify-between md:gap-4 md:px-0">
          <h2 className="text-lg font-medium leading-[1.2] text-text-default max-md:min-h-[29px] md:text-[32px]">
            {t('title')}
          </h2>

          <div className="flex shrink-0 gap-1 rounded-3xl bg-surface-page-bg p-1">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={clsx(
                  'flex h-[50px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[20px] pl-4 pr-6 text-sm font-medium transition-colors md:flex-none',
                  // Подпись таббара в макете #FFFFFF, но макет нарисован только в
                  // тёмной теме: там подложка #262626/#1A1A1A. В светлой белый на
                  // белом нечитаем, поэтому берётся обычный текстовый токен.
                  "text-text-always-white [:root[data-theme='light']_&]:text-text-default",
                  view === v ? 'bg-surface-page-surf1' : 'hover:bg-comp-surface1-hover',
                )}
              >
                <Icon name={v === 'list' ? 'list_alt' : 'map'} size={20} />
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
          <div className="flex flex-col gap-1 lg:gap-12" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-[20px] bg-surface-page-surf2 p-4 md:px-6 md:pb-4 md:pt-6 lg:flex lg:items-center lg:gap-4 lg:bg-transparent lg:px-0 lg:py-0"
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
            {geoDenied && (
              <p className="mb-4 px-2 text-sm text-text-disabled md:px-0">{tb('geoHint')}</p>
            )}

            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-14 text-center">
                <Icon name="search_off" size={32} className="text-text-disabled" />
                <p className="text-base text-text-default">{t('nothingFound')}</p>
              </div>
            ) : view === 'list' ? (
              <ul className="flex flex-col gap-1 lg:gap-12">
                {rows.map((row) => (
                  <li
                    key={row.depId}
                    ref={(el) => {
                      if (el) rowRefs.current.set(row.depId, el);
                      else rowRefs.current.delete(row.depId);
                    }}
                    className={clsx(
                      'rounded-[20px] bg-surface-page-surf2 p-4 transition-shadow md:px-6 md:pb-4 md:pt-6 lg:flex lg:items-center lg:bg-transparent lg:px-0 lg:py-0',
                      activeDepId === row.depId &&
                        'ring-2 ring-stroke-brand lg:ring-offset-4 lg:ring-offset-surface-page-surf1',
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-6 md:flex-row md:items-center md:gap-0 lg:grow">
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

                        {/* Строка «иконка + адрес + расстояние + копирование»:
                            в макете ровно 20px, отступ глифа копии от текста 16.
                            Хит-зона 44×44 гасится отрицательными полями. */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="flex min-w-0 items-center gap-2 text-base leading-5 text-text-default lg:font-system lg:font-semibold lg:tracking-[-0.31px]">
                            <Icon
                              name="account_balance"
                              size={20}
                              className="shrink-0 text-text-default"
                            />
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
                          </span>
                          <button
                            type="button"
                            aria-label={tb('copy')}
                            onClick={() =>
                              copyAddress(
                                row.depId,
                                row.city ? `${row.city}, ${row.address}` : row.address,
                              )
                            }
                            className="-my-3 -ml-3 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-default transition-colors hover:text-text-brand"
                          >
                            <Icon name="content_copy" size={20} />
                          </button>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center md:w-[308px]">
                        <RateCell
                          label={tr('buy')}
                          labelNarrow={t('buyUsd')}
                          value={rateOf(row, 'buy')}
                        />
                        <RateCell
                          label={tr('sell')}
                          labelNarrow={t('sellUsd')}
                          value={rateOf(row, 'sell')}
                        />
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
                        <Icon name="map" size={28} />
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/booking?depId=${row.depId}`)}
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
                  mapOverlay ? 'fixed inset-0 z-50 bg-surface-page-bg' : 'relative rounded-[20px]',
                )}
              >
                <BranchMap
                  markers={markers}
                  fitIds={fitIds}
                  center={mapCenter}
                  userPos={userPos}
                  cooperative={!mapOverlay}
                  onMarkerClick={(id) => {
                    setActiveDepId(id);
                    const hit = rows.find((r) => r.depId === id);
                    if (hit?.coords) setMapCenter(hit.coords);
                  }}
                  onBackgroundClick={() => setActiveDepId(null)}
                  label={t('title')}
                  emptyText={t('nothingFound')}
                  labels={mapLabels}
                  className={mapOverlay ? 'h-full' : 'h-[420px] md:h-[517px] lg:h-[717px]'}
                />

                {/* Круглая кнопка выхода из полноэкранной карты — инстанс «close»
                    [1355:88288]: 44×44, r40, surf1, иконка 20, отступ 16. */}
                {narrow && (
                  <button
                    type="button"
                    aria-label={t('close')}
                    onClick={closeMap}
                    className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface2-hover"
                  >
                    <Icon name="close" size={20} />
                  </button>
                )}

                {/* Кнопка разворота есть только на 768 и 1024: на 1920 карта уже
                    1136×717 и в макете кнопки нет, ниже 768 карта и так во весь
                    экран. Заливка btns/AlwaysWhite (#F5F3F2) одинакова в обеих
                    темах, поэтому и текст берётся инвариантный font/AlwaysBlack
                    (#1A1A1A): text-inverted в светлой теме дал бы #EEEEEE на
                    почти белом. */}
                <button
                  type="button"
                  onClick={() => setMapFull((v) => !v)}
                  className="absolute bottom-4 left-1/2 z-10 inline-flex h-[38px] -translate-x-1/2 cursor-pointer items-center gap-2 rounded-[20px] bg-btn-always-white pl-4 pr-6 text-sm font-medium text-[#1A1A1A] transition-opacity hover:opacity-90 max-md:hidden min-[1440px]:hidden"
                >
                  <Icon name={mapFull ? 'close_fullscreen' : 'open_in_full'} size={20} />
                  {mapFull ? t('fullscreenExit') : t('fullscreen')}
                </button>

                {/* Виджет отделения поверх карты — фрейм «map card» макета:
                    360×282, padding 20/24/24/24, r32, обводка 2px брендом.
                    Ниже 768 он же шторкой во всю ширину внизу экрана. */}
                {mapSelected && (
                  <div
                    role="dialog"
                    aria-label={mapSelected.title}
                    className="fixed inset-x-0 bottom-0 z-50 max-h-[85%] overflow-y-auto rounded-[32px] border-2 border-stroke-brand bg-surface-page-surf1 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:absolute md:inset-x-auto md:bottom-auto md:left-6 md:top-6 md:z-20 md:w-[360px] md:pb-6"
                  >
                    <div className="flex items-start justify-between gap-10">
                      <h3 className="text-lg font-bold leading-6 text-text-default">
                        {mapSelected.title}
                      </h3>
                      {mapSelected.badges.length > 0 && (
                        // Колонка бейджей Frame 1437255110: правый край бейджей
                        // совпадает с правым краем контента карточки, отступ 20
                        // только слева, от названия.
                        <div className="flex flex-col items-end justify-center gap-1 pl-5">
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
                    </div>

                    <div className="mt-1 flex flex-col gap-2 font-inter text-sm font-medium leading-[1.4] text-text-disabled">
                      <span className="flex items-center gap-2">
                        <Icon name="location_on" size={16} className="shrink-0" />
                        <span className="min-w-0 break-words" title={mapSelected.rawAddress}>
                          {mapSelected.city ? `${mapSelected.city}, ` : ''}
                          {mapSelected.address}
                        </span>
                        {mapSelected.distanceKm != null && (
                          <>
                            <Dot />
                            <span className="whitespace-nowrap">
                              {formatNumber(mapSelected.distanceKm, locale, 1)} {tb('km')}
                            </span>
                          </>
                        )}
                      </span>
                      {mapSelected.timetable && (
                        <span className="flex items-center gap-2">
                          <Icon name="schedule" size={16} className="shrink-0" />
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

                    {mapSelected.usd && (
                      <div className="mt-4 flex items-stretch rounded-2xl border border-divider-additional px-2.5 py-1.5">
                        <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
                          <span className="text-xs leading-[18px] text-text-disabled">
                            {tr('buy')}
                          </span>
                          <span className="text-lg font-bold leading-6 text-text-default">
                            {rateOf(mapSelected, 'buy')} {currencySymbol('KZT')}
                          </span>
                        </div>
                        <div aria-hidden className="w-px shrink-0 bg-divider-additional" />
                        <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
                          <span className="text-xs leading-[18px] text-text-disabled">
                            {tr('sell')}
                          </span>
                          <span className="text-lg font-bold leading-6 text-text-default">
                            {rateOf(mapSelected, 'sell')} {currencySymbol('KZT')}
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => router.push(`/booking?depId=${mapSelected.depId}`)}
                      className="mt-3 flex h-[46px] w-full cursor-pointer items-center justify-center rounded-[20px] bg-btn-brand px-6 text-sm font-medium text-text-always-white transition-[filter] hover:brightness-110"
                    >
                      {t('book')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
