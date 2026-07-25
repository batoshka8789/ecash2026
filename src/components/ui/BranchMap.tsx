'use client';

import { useEffect, useMemo, useRef } from 'react';
import { LngLatBounds, MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { clsx } from 'clsx';
import { Icon } from './Icon';

/** Тон бейджа у пина — те же три состояния, что и в списке отделений. */
export type BranchMapBadgeTone = 'best' | 'happyHours' | 'nearest';

export type BranchMapMarker = {
  id: number;
  lat: number;
  lon: number;
  label: string;
  active?: boolean;
  /** Подпись над пином («Самый выгодный») — как во фрейме «on map» макета. */
  badge?: { text: string; tone: BranchMapBadgeTone } | null;
};

type BranchMapProps = {
  markers: BranchMapMarker[];
  /**
   * Подмножество id, по которому вписывается камера при первом показе.
   * Без него границы считаются по всем точкам — для сети в двух городах это
   * вид «весь Казахстан». Остальные пины остаются на карте.
   */
  fitIds?: number[];
  /** Явный центр (кнопка «На карте» у отделения) — берёт верх над авто-вписыванием. */
  center?: { lat: number; lon: number };
  onMarkerClick?: (id: number) => void;
  /** Клик по «пустой» карте — закрывает карточку отделения. */
  onBackgroundClick?: () => void;
  /** Позиция пользователя: синяя точка + кнопка «Моё местоположение». */
  userPos?: { lat: number; lon: number } | null;
  /** Кнопки масштаба и «моё местоположение» поверх карты. */
  controls?: boolean;
  /**
   * Кооперативные жесты: одним пальцем страница скроллится сквозь карту,
   * панорамирование — двумя, зум колесом — с Ctrl/⌘. Нужно там, где карта
   * встроена в длинную страницу; для карты-пикера мешает, поэтому по
   * умолчанию выключено.
   */
  cooperative?: boolean;
  /** Доступное имя области карты. */
  label: string;
  /** Подпись пустого состояния; без неё показывается только иконка. */
  emptyText?: string;
  labels?: { zoomIn?: string; zoomOut?: string; myLocation?: string; gestureHint?: string };
  /** Размеры задаёт вызывающий (например, h-[717px]). */
  className?: string;
};

/** Алматы — фоллбэк-центр, пока нет ни точек, ни center. */
const FALLBACK_CENTER: [number, number] = [76.8897, 43.2389];

const badgeTone: Record<BranchMapBadgeTone, string> = {
  best: 'bg-brand',
  happyHours: 'bg-additional-2',
  nearest: 'bg-additional-3',
};

/**
 * Пин отделения по макету: брендовый круг 40×40 с белым знаком ecash и
 * подписью-бейджем сверху. Кликабельная область — 48×48 (минимум для тапа),
 * сам круг остаётся 40×40.
 */
function makePin(marker: BranchMapMarker): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.title = marker.label;
  el.setAttribute('aria-label', marker.label);
  el.className =
    'relative flex h-12 w-12 cursor-pointer items-center justify-center border-0 bg-transparent p-0';
  if (marker.active) el.style.zIndex = '2';

  const dot = document.createElement('span');
  dot.className = clsx(
    'flex h-10 w-10 items-center justify-center rounded-full bg-brand shadow-[0_2px_8px_rgb(0_0_0/0.45)] transition-transform',
    marker.active && 'scale-110 ring-[6px] ring-brand-hardsoft',
  );

  const mark = document.createElement('img');
  mark.src = '/img/mark-white.png';
  mark.alt = '';
  mark.width = 111;
  mark.height = 159;
  mark.className = 'h-6 w-auto';
  dot.append(mark);
  el.append(dot);

  if (marker.badge) {
    const badge = document.createElement('span');
    badge.className = clsx(
      'pointer-events-none absolute bottom-[38px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 text-xs font-bold leading-[18px] text-text-always-white',
      badgeTone[marker.badge.tone],
    );
    badge.textContent = marker.badge.text;
    el.append(badge);
  }

  return el;
}

/** Точка пользователя — некликабельная синяя метка. */
function makeUserDot(label: string): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.title = label;
  el.className =
    'h-4 w-4 rounded-full bg-additional-3 ring-2 ring-white shadow-[0_0_0_6px_rgb(0_102_255/0.25)]';
  return el;
}

/**
 * Отделения с одинаковыми координатами (в данных Ecash их несколько — три
 * точки лежат ровно друг на друге) расталкиваются по кругу в пикселях, иначе
 * доступен только верхний пин. Смещение пиксельное, привязка к координате
 * сохраняется.
 */
function spiderfy(markers: BranchMapMarker[]): Map<number, [number, number]> {
  const groups = new Map<string, number[]>();
  for (const m of markers) {
    const key = `${m.lat.toFixed(5)},${m.lon.toFixed(5)}`;
    const group = groups.get(key);
    if (group) group.push(m.id);
    else groups.set(key, [m.id]);
  }

  const offsets = new Map<number, [number, number]>();
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const radius = 16 + ids.length * 4;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ids.length;
      offsets.set(id, [radius * Math.sin(angle), -radius * Math.cos(angle)]);
    });
  }
  return offsets;
}

/**
 * Интерактивная карта отделений: MapLibre + растровые тайлы OSM (без ключей,
 * атрибуция обязательна). Карта создаётся лениво в эффекте и уничтожается при
 * размонтировании; контейнер следит за своим размером через ResizeObserver.
 *
 * Жесты «кооперативные»: одним пальцем страница скроллится сквозь карту, для
 * панорамирования нужны два пальца, для зума колесом — Ctrl/⌘. В развёрнутом
 * режиме ограничение снимается. Зум доступен кнопками — они же спасают там,
 * где модификатор недоступен.
 */
const DEFAULT_LABELS = { zoomIn: 'Zoom in', zoomOut: 'Zoom out', myLocation: 'My location' };

export function BranchMap({
  markers,
  fitIds,
  center,
  onMarkerClick,
  onBackgroundClick,
  userPos,
  controls = false,
  cooperative = false,
  label,
  emptyText,
  labels,
  className,
}: BranchMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinsRef = useRef<Marker[]>([]);
  const userPinRef = useRef<Marker | null>(null);
  /** Сигнатура набора id, под который уже вписали границы, — чтобы смена
   *  active-точки не дёргала камеру. */
  const fittedIdsRef = useRef('');
  /** Слепок отрисованных пинов: список маркеров пересоздаётся при каждом
   *  ре-рендере родителя (в том числе раз в минуту, когда пересчитывается
   *  «Открыто/Закрыто»), а DOM пинов трогать при этом незачем. */
  const drawnSigRef = useRef<string | null>(null);

  const l = { ...DEFAULT_LABELS, ...labels };

  // Свежие колбэки и подписи без пересоздания карты и маркеров.
  const clickRef = useRef(onMarkerClick);
  const bgClickRef = useRef(onBackgroundClick);
  const labelsRef = useRef(l);
  const cooperativeRef = useRef(cooperative);
  useEffect(() => {
    clickRef.current = onMarkerClick;
    bgClickRef.current = onBackgroundClick;
    labelsRef.current = l;
  });

  // Создание и уничтожение карты.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Подсказка о жестах приходит из переводов вызывающего; без неё MapLibre
    // покажет собственный английский текст.
    const hint = labelsRef.current.gestureHint;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              maxzoom: 19,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: FALLBACK_CENTER,
        zoom: 11,
        attributionControl: { compact: true },
        cooperativeGestures: cooperativeRef.current,
        ...(hint
          ? {
              locale: {
                'CooperativeGesturesHandler.MacHelpText': hint,
                'CooperativeGesturesHandler.WindowsHelpText': hint,
                'CooperativeGesturesHandler.MobileHelpText': hint,
              },
            }
          : {}),
      });
    } catch {
      // WebGL недоступен — остаётся пустой контейнер.
      return;
    }
    mapRef.current = map;

    const onMapClick = () => bgClickRef.current?.();
    map.on('click', onMapClick);

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.off('click', onMapClick);
      pinsRef.current.forEach((pin) => pin.remove());
      pinsRef.current = [];
      userPinRef.current?.remove();
      userPinRef.current = null;
      fittedIdsRef.current = '';
      drawnSigRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // В развёрнутой карте жесты работают напрямую — модификатор там мешает.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    cooperativeRef.current = cooperative;
    if (cooperative && !map.cooperativeGestures.isEnabled()) map.cooperativeGestures.enable();
    if (!cooperative && map.cooperativeGestures.isEnabled()) map.cooperativeGestures.disable();
  }, [cooperative]);

  const offsets = useMemo(() => spiderfy(markers), [markers]);

  /** Всё, что влияет на DOM пина. */
  const markersSig = useMemo(
    () =>
      markers
        .map((m) => {
          const [dx, dy] = offsets.get(m.id) ?? [0, 0];
          return `${m.id}:${m.lat}:${m.lon}:${m.active ? 1 : 0}:${m.badge?.tone ?? ''}:${m.badge?.text ?? ''}:${dx},${dy}`;
        })
        .join('|'),
    [markers, offsets],
  );

  const fitKey = fitIds ? [...fitIds].sort((a, b) => a - b).join(',') : '';

  // Синхронизация маркеров + вписывание границ по новому набору точек.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Пины перерисовываются только при реальном изменении их содержимого:
    // родитель отдаёт новый массив на каждый ре-рендер.
    if (drawnSigRef.current !== markersSig) {
      drawnSigRef.current = markersSig;
      pinsRef.current.forEach((pin) => pin.remove());
      pinsRef.current = markers.map((m) => {
        const el = makePin(m);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          clickRef.current?.(m.id);
        });
        return new Marker({ element: el, anchor: 'center', offset: offsets.get(m.id) ?? [0, 0] })
          .setLngLat([m.lon, m.lat])
          .addTo(map);
      });
    }

    const fitSet = fitIds && fitIds.length > 0 ? new Set(fitIds) : null;
    const toFit = fitSet ? markers.filter((m) => fitSet.has(m.id)) : markers;
    if (toFit.length > 0) {
      const ids = toFit
        .map((m) => m.id)
        .sort((a, b) => a - b)
        .join(',');
      if (ids !== fittedIdsRef.current) {
        fittedIdsRef.current = ids;
        const bounds = new LngLatBounds();
        toFit.forEach((m) => bounds.extend([m.lon, m.lat]));
        map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 0 });
      }
    }
  }, [markers, offsets, markersSig, fitIds, fitKey]);

  // Точка пользователя появляется/исчезает вместе с разрешением на геолокацию.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userPinRef.current?.remove();
    userPinRef.current = null;
    if (!userPos) return;
    userPinRef.current = new Marker({
      element: makeUserDot(labelsRef.current.myLocation),
      anchor: 'center',
    })
      .setLngLat([userPos.lon, userPos.lat])
      .addTo(map);
  }, [userPos]);

  // Явный центр — плавный перелёт к выбранному отделению.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.easeTo({
      center: [center.lon, center.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 500,
    });
  }, [center]);

  const controlClass =
    'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-surface-page-surf3 bg-surface-page-surf1/95 text-text-default shadow-lg backdrop-blur-md transition-colors hover:bg-comp-surface2-hover';

  return (
    <div className={clsx('relative overflow-hidden bg-surface-page-surf2', className)}>
      <div ref={containerRef} role="region" aria-label={label} className="h-full w-full" />

      {controls && (
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            aria-label={l.zoomIn}
            onClick={() => mapRef.current?.zoomIn()}
            className={controlClass}
          >
            <Icon name="add" size={22} />
          </button>
          <button
            type="button"
            aria-label={l.zoomOut}
            onClick={() => mapRef.current?.zoomOut()}
            className={controlClass}
          >
            <Icon name="remove" size={22} />
          </button>
          {userPos && (
            <button
              type="button"
              aria-label={l.myLocation}
              onClick={() =>
                mapRef.current?.easeTo({
                  center: [userPos.lon, userPos.lat],
                  zoom: Math.max(mapRef.current.getZoom(), 13),
                  duration: 500,
                })
              }
              className={controlClass}
            >
              <Icon name="my_location" size={20} />
            </button>
          )}
        </div>
      )}

      {markers.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-text-disabled">
          <Icon name="location_off" size={32} />
          {emptyText && <span className="text-sm">{emptyText}</span>}
        </div>
      )}
    </div>
  );
}
