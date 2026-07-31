/**
 * Общий интерфейс для картографических движков BranchMap. Два реальных
 * провайдера — 2GIS MapGL (dgis.ts, требует ключ, см. platform.2gis.ru) и
 * Yandex Maps JS API 2.1 (yandex.ts, ключа не требует). BranchMap.tsx не
 * знает о конкретном SDK — только об этом интерфейсе, поэтому переключение
 * провайдера в рантайме — это просто destroy() старого драйвера и mount()
 * нового в тот же контейнер.
 */

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

export type DriverPoint = { lat: number; lon: number };

/**
 * DOM-элемент пина строится один раз в BranchMap.tsx (см. pins.ts) — драйвер
 * его позиционирует и САМ подписывает onClick своим механизмом. Единый
 * нативный listener на el здесь невозможен: у 2GIS HtmlMarker — настоящий
 * DOM поверх канваса и DOM-клик работает, а Yandex 2.1 накрывает все паны
 * с метками собственным прозрачным events-паном, который съедает нативные
 * события — клики там существуют только внутри событийной системы ymaps.
 * offsetX/offsetY — пиксельное смещение от истинной геоточки (спайдерфай
 * налезающих друг на друга отделений, см. pins.ts/spiderfy); каждый драйвер
 * реализует его своим механизмом (anchor у 2GIS, CSS-margin у Yandex).
 */
export type MapDriverMarkerSpec = {
  id: number;
  lat: number;
  lon: number;
  el: HTMLElement;
  zIndex: number;
  offsetX: number;
  offsetY: number;
  /**
   * Клик по пину. Контракт: драйвер обязан НЕ пропускать этот же клик в
   * onBackgroundClick — иначе карточка отделения закрывалась бы тем же
   * кликом, которым открылась.
   */
  onClick?: () => void;
};

export interface MapDriver {
  /** Создаёт карту в контейнере. Резолвится, когда движок готов рисовать. */
  mount(
    container: HTMLElement,
    opts: {
      center: DriverPoint;
      zoom: number;
      /** Лучшее доступное приближение «кооперативных жестов» — см. проп cooperative в BranchMap. */
      disableScrollZoom: boolean;
      onBackgroundClick: () => void;
    },
  ): Promise<void>;
  /** Уничтожает карту и освобождает все ресурсы движка. */
  destroy(): void;
  /** Полная замена набора пинов отделений. */
  setMarkers(markers: MapDriverMarkerSpec[]): void;
  /** Точка «моё местоположение»; null — убрать. */
  setUserMarker(pos: DriverPoint | null, el: HTMLElement | null): void;
  setCenter(center: DriverPoint, zoom?: number): void;
  fitBounds(points: DriverPoint[], paddingPx: number, maxZoom: number): void;
  getZoom(): number;
  zoomTo(zoom: number): void;
  /** Вызывается после изменения размера контейнера (ResizeObserver в BranchMap). */
  invalidateSize(): void;
}

export type MapProviderId = 'dgis' | 'yandex';

export interface MapDriverModule {
  id: MapProviderId;
  label: string;
  /**
   * Статическая проверка БЕЗ попытки загрузки движка (нужна для выбора
   * провайдера по умолчанию и для disabled-состояния кнопки переключателя
   * ДО того, как пользователь вообще успел кликнуть).
   */
  isConfigured(): boolean;
  create(): MapDriver;
}
