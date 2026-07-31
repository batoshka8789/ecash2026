import { load } from '@2gis/mapgl';
import type { DriverPoint, MapDriver, MapDriverMarkerSpec, MapDriverModule } from './types';

/** Ключ MapGL JS API — https://platform.2gis.ru/ (демо-ключ бесплатный, нужен аккаунт). */
const DGIS_KEY = process.env.NEXT_PUBLIC_DGIS_API_KEY;

/** Алматы — фоллбэк-центр, пока нет ни точек, ни center. */
const FALLBACK_CENTER: [number, number] = [76.8897, 43.2389];

/** Пространство имён 2GIS MapGL, отдаваемое `load()`, — тип берём из него самого. */
type Mapgl = Awaited<ReturnType<typeof load>>;
type DgisMap = InstanceType<Mapgl['Map']>;
type DgisHtmlMarker = InstanceType<Mapgl['HtmlMarker']>;

function createDgisMarker(mapglNS: Mapgl, map: DgisMap, m: MapDriverMarkerSpec): DgisHtmlMarker {
  // anchor — офсет «носика» маркера от его левого верхнего угла, а не
  // центрирование по ключевому слову, как у MapLibre; половина стороны
  // пина (24 = 48/2) центрирует его, спайдерфай-офсет вычитается из anchor
  // (рост anchor сдвигает элемент влево/вверх, поэтому вычитаем, а не прибавляем).
  return new mapglNS.HtmlMarker(map, {
    coordinates: [m.lon, m.lat],
    html: m.el,
    anchor: [24 - m.offsetX, 24 - m.offsetY],
    interactive: true,
    zIndex: m.zIndex,
  });
}

function createDgisDriver(): MapDriver {
  let mapglNS: Mapgl | null = null;
  let map: DgisMap | null = null;
  let pins: DgisHtmlMarker[] = [];
  let userPin: DgisHtmlMarker | null = null;
  let onMapClick: (() => void) | null = null;

  return {
    async mount(container, opts) {
      if (!DGIS_KEY) throw new Error('NEXT_PUBLIC_DGIS_API_KEY не задан');
      const ns = await load();
      if (!ns.isSupported()) {
        throw new Error(`браузер не поддерживает 2GIS MapGL: ${ns.notSupportedReason() ?? ''}`);
      }
      mapglNS = ns;
      map = new ns.Map(container, {
        center: opts.center ? [opts.center.lon, opts.center.lat] : FALLBACK_CENTER,
        zoom: opts.zoom,
        key: DGIS_KEY,
        // свои кнопки зума рисуются в BranchMap, встроенные не нужны
        zoomControl: false,
        // единственное приближение «кооперативных жестов» — константа на
        // момент создания карты, не переключается на лету (см. types.ts)
        disableZoomOnScroll: opts.disableScrollZoom,
      });
      onMapClick = () => opts.onBackgroundClick();
      map.on('click', onMapClick);
    },

    destroy() {
      pins.forEach((p) => p.destroy());
      pins = [];
      userPin?.destroy();
      userPin = null;
      if (map && onMapClick) map.off('click', onMapClick);
      map?.destroy();
      map = null;
      mapglNS = null;
      onMapClick = null;
    },

    setMarkers(markers) {
      if (!mapglNS || !map) return;
      pins.forEach((p) => p.destroy());
      pins = markers.map((m) => createDgisMarker(mapglNS!, map!, m));
    },

    setUserMarker(pos, el) {
      userPin?.destroy();
      userPin = null;
      if (!mapglNS || !map || !pos || !el) return;
      userPin = new mapglNS.HtmlMarker(map, {
        coordinates: [pos.lon, pos.lat],
        html: el,
        anchor: [8, 8],
        interactive: false,
        preventMapInteractions: false,
      });
    },

    setCenter(center, zoom) {
      if (!map) return;
      map.setCenter([center.lon, center.lat], { animate: true, duration: 500 });
      if (zoom !== undefined) map.setZoom(Math.max(map.getZoom(), zoom), { animate: true, duration: 500 });
    },

    fitBounds(points, paddingPx, maxZoom) {
      if (!map || points.length === 0) return;
      let minLon = Infinity;
      let minLat = Infinity;
      let maxLon = -Infinity;
      let maxLat = -Infinity;
      for (const p of points) {
        minLon = Math.min(minLon, p.lon);
        maxLon = Math.max(maxLon, p.lon);
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
      }
      map.fitBounds(
        { southWest: [minLon, minLat], northEast: [maxLon, maxLat] },
        {
          padding: { top: paddingPx, right: paddingPx, bottom: paddingPx, left: paddingPx },
          maxZoom,
          animation: { animate: false },
        },
      );
    },

    getZoom() {
      return map?.getZoom() ?? 0;
    },

    zoomTo(zoom) {
      map?.setZoom(zoom, { animate: true, duration: 200 });
    },

    invalidateSize() {
      map?.invalidateSize();
    },
  };
}

export const dgisDriverModule: MapDriverModule = {
  id: 'dgis',
  label: '2GIS',
  isConfigured: () => Boolean(DGIS_KEY),
  create: createDgisDriver,
};

export type { DriverPoint };
