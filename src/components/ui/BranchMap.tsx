'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from './Icon';
import { dgisDriverModule } from './map-drivers/dgis';
import { yandexDriverModule } from './map-drivers/yandex';
import { makePin, makeUserDot, spiderfy } from './map-drivers/pins';
import type {
  BranchMapBadgeTone,
  BranchMapMarker,
  MapDriver,
  MapDriverModule,
  MapProviderId,
} from './map-drivers/types';

export type { BranchMapBadgeTone, BranchMapMarker };

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
   * Кооперативные жесты (как у MapLibre): одним пальцем страница скроллится
   * сквозь карту, панорамирование — двумя, зум колесом — с Ctrl/⌘. Ни у
   * 2GIS, ни у Yandex такого режима нет — оба драйвера лишь блокируют
   * скролл-зум БЕЗ модификатора при создании карты (не переключается на
   * лету), это осознанное ограничение, а не недосмотр.
   */
  cooperative?: boolean;
  /** Доступное имя области карты. */
  label: string;
  /** Подпись пустого состояния; без неё показывается только иконка. */
  emptyText?: string;
  /** Подпись состояния «карта недоступна» (оба провайдера не смогли загрузиться); фоллбэк — emptyText. */
  unavailableText?: string;
  /**
   * Доп. классы переключателя провайдера (левый нижний угол). На /locations
   * по центру низа лежит кнопка «Развернуть на весь экран» из макета — на
   * узких экранах пилюли сталкивались, вызывающий поднимает переключатель.
   */
  providerClassName?: string;
  labels?: {
    zoomIn?: string;
    zoomOut?: string;
    myLocation?: string;
    gestureHint?: string;
    provider?: string;
  };
  /** Размеры задаёт вызывающий (например, h-[717px]). */
  className?: string;
};

const DEFAULT_LABELS = { zoomIn: 'Zoom in', zoomOut: 'Zoom out', myLocation: 'My location' };

/** Порядок предпочтения: 2GIS первым, если у него есть ключ, иначе сразу Yandex. */
const PROVIDERS: MapDriverModule[] = [dgisDriverModule, yandexDriverModule];

/** Первый настроенный провайдер — вычисляется один раз на модуль, не на рендер. */
const DEFAULT_PROVIDER_ID: MapProviderId =
  PROVIDERS.find((p) => p.isConfigured())?.id ?? PROVIDERS[0].id;

/** Алматы — фоллбэк-центр, пока нет ни точек, ни center. */
const FALLBACK_CENTER = { lat: 43.2389, lon: 76.8897 };

type ProviderState = {
  /** Провайдер, чья карта сейчас реально смонтирована и видна. */
  activeId: MapProviderId | null;
  status: 'loading' | 'ready' | 'unavailable';
  failed: Partial<Record<MapProviderId, true>>;
};

/**
 * Интерактивная карта отделений поверх переключаемого движка — 2GIS MapGL
 * (нужен ключ, см. NEXT_PUBLIC_DGIS_API_KEY) или Yandex Maps JS API 2.1
 * (ключа не требует). BranchMap сам не знает про конкретный SDK — вся
 * разница спрятана за интерфейсом MapDriver (map-drivers/types.ts), поэтому
 * переключение провайдера — это destroy() старого драйвера и mount() нового
 * в тот же контейнер, без пересоздания React-дерева.
 *
 * Переключатель провайдера — пилюли в левом нижнем углу; недоступный
 * провайдер (нет ключа 2GIS, либо у любого из двух не загрузился SDK)
 * показан, но некликабелен. Если сработавший по умолчанию провайдер не
 * смог смонтироваться — автоматически пробуем следующий по списку; если и
 * тот не смог — карта уходит в общее пустое состояние `unavailableText`.
 */
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
  unavailableText,
  providerClassName,
  labels,
  className,
}: BranchMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const driverRef = useRef<MapDriver | null>(null);
  const fittedIdsRef = useRef('');
  const drawnSigRef = useRef<string | null>(null);
  const locale = useLocale();

  /** null — авто-режим (перебор PROVIDERS по порядку с каскадом на отказе);
   *  конкретный id — пользователь явно выбрал этот провайдер пилюлей внизу
   *  слева, каскада на другой в этом режиме нет — уважаем явный выбор. */
  const [manualProvider, setManualProvider] = useState<MapProviderId | null>(null);
  /** Счётчик повторов: клик по упавшему провайдеру перезапускает mount-эффект
   *  даже когда manualProvider не меняется (тот же провайдер второй раз). */
  const [retryNonce, setRetryNonce] = useState(0);
  const [providerState, setProviderState] = useState<ProviderState>(() => ({
    activeId: null,
    status: 'loading',
    failed: Object.fromEntries(PROVIDERS.filter((p) => !p.isConfigured()).map((p) => [p.id, true])),
  }));

  const l = { ...DEFAULT_LABELS, ...labels };

  // Свежие колбэки/пропы без пересоздания карты.
  const clickRef = useRef(onMarkerClick);
  const bgClickRef = useRef(onBackgroundClick);
  const cooperativeRef = useRef(cooperative);
  const centerRef = useRef(center);
  const localeRef = useRef(locale);
  useEffect(() => {
    clickRef.current = onMarkerClick;
    bgClickRef.current = onBackgroundClick;
    cooperativeRef.current = cooperative;
    centerRef.current = center;
    localeRef.current = locale;
  });

  // Монтирование: в авто-режиме перебираем PROVIDERS по порядку и на отказе
  // сразу пробуем следующего (без лишнего рендера между попытками — это
  // один async-проход внутри одного эффекта); в ручном — только выбранный.
  // Все setState — исключительно из асинхронных продолжений (после await
  // или в catch), ни одного синхронного вызова в теле эффекта.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let mountedDriver: MapDriver | null = null;

    const order = manualProvider ? PROVIDERS.filter((p) => p.id === manualProvider) : PROVIDERS;

    async function run() {
      const newlyFailed: MapProviderId[] = [];
      for (const p of order) {
        if (cancelled) return;
        if (!p.isConfigured()) {
          newlyFailed.push(p.id);
          continue;
        }
        const driver = p.create();
        try {
          await driver.mount(container!, {
            center: centerRef.current ?? FALLBACK_CENTER,
            zoom: 11,
            disableScrollZoom: cooperativeRef.current,
            lang: localeRef.current,
            onBackgroundClick: () => bgClickRef.current?.(),
          });
          if (cancelled) {
            driver.destroy();
            return;
          }
          mountedDriver = driver;
          driverRef.current = driver;
          fittedIdsRef.current = '';
          drawnSigRef.current = null;
          setProviderState((prev) => ({
            activeId: p.id,
            status: 'ready',
            failed: { ...prev.failed, ...Object.fromEntries(newlyFailed.map((id) => [id, true])) },
          }));
          return;
        } catch (err) {
          console.error(`[ecash] карта ${p.label} недоступна:`, err);
          driver.destroy();
          newlyFailed.push(p.id);
        }
      }
      if (!cancelled) {
        setProviderState((prev) => ({
          activeId: null,
          status: 'unavailable',
          failed: { ...prev.failed, ...Object.fromEntries(newlyFailed.map((id) => [id, true])) },
        }));
      }
    }

    run();

    return () => {
      cancelled = true;
      if (driverRef.current === mountedDriver) driverRef.current = null;
      mountedDriver?.destroy();
    };
  }, [manualProvider, retryNonce]);

  // Контейнер меняет размер (разворот на весь экран, resize окна) — драйвер
  // должен пересчитать канвас/вьюпорт сам, эффект тут был бы недостаточен:
  // размер часто меняется не из-за ре-рендера React, а из-за CSS/раскладки.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => driverRef.current?.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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
    const driver = driverRef.current;
    if (!driver || providerState.status !== 'ready') return;

    // Пины перерисовываются только при реальном изменении их содержимого:
    // родитель отдаёт новый массив на каждый ре-рендер.
    if (drawnSigRef.current !== markersSig) {
      drawnSigRef.current = markersSig;
      driver.setMarkers(
        markers.map((m) => {
          const [dx, dy] = offsets.get(m.id) ?? [0, 0];
          return {
            id: m.id,
            lat: m.lat,
            lon: m.lon,
            el: makePin(m),
            zIndex: m.active ? 2 : 1,
            offsetX: dx,
            offsetY: dy,
            // Подписку вешает сам драйвер (у Yandex нативный DOM-клик по el
            // не работает — см. types.ts). Через ref, а не напрямую: пины
            // пересоздаются только при смене markersSig, а колбэк родителя
            // обновляется каждый ре-рендер — иначе застряло бы старое замыкание.
            onClick: () => clickRef.current?.(m.id),
          };
        }),
      );
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
        driver.fitBounds(
          toFit.map((m) => ({ lat: m.lat, lon: m.lon })),
          56,
          15,
        );
      }
    }
  }, [markers, offsets, markersSig, fitIds, fitKey, providerState.status]);

  // Точка пользователя появляется/исчезает вместе с разрешением на геолокацию.
  useEffect(() => {
    const driver = driverRef.current;
    if (!driver || providerState.status !== 'ready') return;
    driver.setUserMarker(userPos ?? null, userPos ? makeUserDot(l.myLocation) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- l.myLocation не должен пересоздавать точку
  }, [userPos, providerState.status]);

  // Явный центр — плавный перелёт к выбранному отделению.
  useEffect(() => {
    const driver = driverRef.current;
    if (!driver || providerState.status !== 'ready' || !center) return;
    driver.setCenter(center, 14);
  }, [center, providerState.status]);

  const controlClass =
    'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-surface-page-surf3 bg-surface-page-surf1/95 text-text-default shadow-lg backdrop-blur-md transition-colors hover:bg-comp-surface2-hover';

  return (
    <div className={clsx('relative overflow-hidden bg-surface-page-surf2', className)}>
      <div ref={containerRef} role="region" aria-label={label} className="h-full w-full" />

      {controls && providerState.status === 'ready' && (
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            aria-label={l.zoomIn}
            onClick={() => driverRef.current && driverRef.current.zoomTo(driverRef.current.getZoom() + 1)}
            className={controlClass}
          >
            <Icon name="add" size={22} />
          </button>
          <button
            type="button"
            aria-label={l.zoomOut}
            onClick={() => driverRef.current && driverRef.current.zoomTo(driverRef.current.getZoom() - 1)}
            className={controlClass}
          >
            <Icon name="remove" size={22} />
          </button>
          {userPos && (
            <button
              type="button"
              aria-label={l.myLocation}
              onClick={() => driverRef.current?.setCenter(userPos, 13)}
              className={controlClass}
            >
              <Icon name="my_location" size={20} />
            </button>
          )}
        </div>
      )}

      {/* Лоадер при первом монтировании и при переключении провайдера:
          иначе пользователь видел просто пустой блок без обратной связи. */}
      {providerState.status === 'loading' && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="sr-only">…</span>
          <div aria-hidden className="h-full w-full animate-pulse rounded-[inherit] bg-surface-page-surf2" />
        </div>
      )}

      {/* Переключатель провайдера — левый нижний угол. Задизейблен только
          ненастроенный вариант (нет ключа 2GIS); упавший из-за сетевой
          ошибки остаётся кликабельным — клик повторяет попытку монтирования
          (транзиентный сбой скрипта не должен хоронить провайдер до
          перезагрузки страницы). */}
      <div
        role="radiogroup"
        aria-label={l.provider ?? 'Map provider'}
        className={clsx(
          'absolute bottom-3 left-3 z-10 inline-flex gap-1 rounded-2xl border border-surface-page-surf3 bg-surface-page-surf1/95 p-1 shadow-lg backdrop-blur-md',
          providerClassName,
        )}
      >
        {PROVIDERS.map((p) => {
          const isActive = p.id === (providerState.activeId ?? manualProvider ?? DEFAULT_PROVIDER_ID);
          const isDisabled = !p.isConfigured();
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled || (isActive && providerState.status === 'ready')) return;
                // setState здесь — в обработчике клика, не в теле эффекта:
                // можно сбросить status синхронно, лоадер покажется без
                // задержки на «карта только что переключилась». Отметку
                // failed снимаем — это и есть повторная попытка.
                setProviderState((prev) => ({
                  ...prev,
                  status: 'loading',
                  failed: Object.fromEntries(
                    Object.entries(prev.failed).filter(([id]) => id !== p.id),
                  ),
                }));
                setManualProvider(p.id);
                setRetryNonce((n) => n + 1);
              }}
              className={clsx(
                'rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                isDisabled
                  ? 'cursor-not-allowed text-text-disabled opacity-50'
                  : isActive
                    ? 'cursor-default bg-brand text-text-always-white'
                    : 'cursor-pointer text-text-default hover:bg-comp-surface2-hover',
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {providerState.status === 'unavailable' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-text-disabled">
          <Icon name="location_off" size={32} />
          {(unavailableText ?? emptyText) && (
            <span className="text-sm">{unavailableText ?? emptyText}</span>
          )}
        </div>
      )}

      {providerState.status === 'ready' && markers.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-text-disabled">
          <Icon name="location_off" size={32} />
          {emptyText && <span className="text-sm">{emptyText}</span>}
        </div>
      )}
    </div>
  );
}
