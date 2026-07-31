import { PIN_SIZE, USER_DOT_SIZE } from './pins';
import type { DriverPoint, MapDriver, MapDriverMarkerSpec, MapDriverModule } from './types';

/**
 * `@types/yandex-maps` — чисто амбиентный пакет (`declare namespace ymaps`
 * + `export = ymaps`), рассчитанный на глобальный `<script>`, а не на явный
 * импорт значения. `typeof import(...)` достаёт из него тип пространства
 * имён БЕЗ `require()` (тот запрещён линтом и всё равно не нужен — рантайм
 * приходит из window.ymaps после загрузки скрипта, не из npm-пакета).
 */
type YMapsNS = typeof import('yandex-maps');
type YMap = InstanceType<YMapsNS['Map']>;
type YPlacemark = InstanceType<YMapsNS['Placemark']>;

declare global {
  interface Window {
    ymaps?: YMapsNS;
  }
}

/** Yandex Maps JS API 2.1 — единственная (не 3.0) версия, которая рисует
 *  полноценную карту БЕЗ ключа: подтверждено вживую (см. историю чата),
 *  3.0 ключ уже требует. Если Yandex когда-нибудь закроет и 2.1 — mount()
 *  здесь упадёт как обычная сетевая/скриптовая ошибка, драйвер и его кнопка
 *  в переключателе провайдера сами уйдут в unavailable, ничего не сломав. */

/**
 * Язык подписей карты из локали приложения. API 2.1 поддерживает только
 * ru_RU/en_US/en_RU/ru_UA/uk_UA/tr_TR — казахского и китайского нет,
 * поэтому kk → ru_RU (привычнее для Казахстана), zh → en_US.
 */
function scriptUrl(lang?: string): string {
  const mapped = lang === 'en' || lang === 'zh' ? 'en_US' : 'ru_RU';
  return `https://api-maps.yandex.ru/2.1/?lang=${mapped}`;
}

/** Скрипт грузим один раз на вкладку — второй BranchMap на той же странице
 *  переиспользует тот же промис, а не вставляет второй <script>. Язык
 *  фиксируется ПЕРВОЙ загрузкой: у 2.1 нет смены языка без перезагрузки
 *  страницы (один глобальный window.ymaps), поэтому клиентская смена локали
 *  подхватится только при следующем полном открытии страницы. */
let loaderPromise: Promise<YMapsNS> | null = null;

function loadYmaps(lang?: string): Promise<YMapsNS> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise<YMapsNS>((resolve, reject) => {
    const existing = window.ymaps;
    if (existing) {
      existing.ready(() => resolve(existing));
      return;
    }
    const script = document.createElement('script');
    script.src = scriptUrl(lang);
    script.async = true;
    script.onload = () => {
      if (!window.ymaps) {
        reject(new Error('скрипт api-maps.yandex.ru загрузился, но window.ymaps не появился'));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps));
    };
    script.onerror = () => reject(new Error('не удалось загрузить api-maps.yandex.ru'));
    document.head.append(script);
  }).catch((err) => {
    // промис-неудачу не кешируем — следующий mount() (например, повторный
    // клик по кнопке провайдера) получит шанс попробовать снова
    loaderPromise = null;
    throw err;
  });
  return loaderPromise;
}

/**
 * `iconShape` в рантайме 2.1 принимает JSON пиксельной геометрии с
 * координатами, но в `@types/yandex-maps` описан лишь базовый `{ type }` —
 * дописываем недостающие поля структурно совместимым локальным типом.
 */
type PixelRectShapeJson = {
  type: 'Rectangle';
  coordinates: [[number, number], [number, number]];
};

/**
 * Хост-обёртка под произвольный DOM-пин (см. pins.ts) — тот же приём, что
 * и у 2GIS: Yandex позиционирует layout своим top-left в точку координаты,
 * а «anchor» имитируем отрицательными margin (сдвигаем контейнер так, чтобы
 * нужная точка el — центр минус спайдерфай-офсет — легла на геоточку).
 */
function createHtmlPlacemark(
  ns: YMapsNS,
  coordinates: [number, number],
  el: HTMLElement,
  anchorX: number,
  anchorY: number,
  sizePx: number,
  zIndex: number,
  interactive: boolean,
): YPlacemark {
  const HostLayout = ns.templateLayoutFactory.createClass('<div class="ecash-pin-host"></div>', {
    build() {
      // @ts-expect-error — build/superclass типизированы в @types/yandex-maps слабо
      HostLayout.superclass.build.call(this);
      const parent = (this as unknown as { getParentElement: () => HTMLElement }).getParentElement();
      const host = parent.querySelector('.ecash-pin-host') as HTMLElement;
      host.style.marginLeft = `${-anchorX}px`;
      host.style.marginTop = `${-anchorY}px`;
      host.style.pointerEvents = interactive ? 'auto' : 'none';
      host.append(el);
    },
    clear() {
      // @ts-expect-error — см. выше
      HostLayout.superclass.clear.call(this);
    },
  });

  // Хит-область метки для событийной системы ymaps. У кастомного iconLayout
  // API сам её вычислить не может: без iconShape метка «прозрачна» для
  // кликов — событие проваливается в 'click' самой карты (у нас это
  // onBackgroundClick), и пин выглядит некликабельным. Координаты — пиксели
  // относительно геоточки; layout сдвинут margin'ами на (-anchorX, -anchorY).
  const shape: PixelRectShapeJson | null = interactive
    ? {
        type: 'Rectangle',
        coordinates: [
          [-anchorX, -anchorY],
          [-anchorX + sizePx, -anchorY + sizePx],
        ],
      }
    : null;

  return new ns.Placemark(
    coordinates,
    {},
    {
      iconLayout: HostLayout,
      iconShape: shape,
      zIndex,
      zIndexHover: zIndex,
      // opaque: событие, попавшее в хит-область метки, НЕ дублируется в
      // события карты — иначе клик по пину открыл бы карточку и тут же
      // закрыл её через onBackgroundClick.
      interactivityModel: 'default#opaque',
    },
  );
}

function createYandexDriver(): MapDriver {
  let map: YMap | null = null;
  let pins: YPlacemark[] = [];
  let userPin: YPlacemark | null = null;
  let ns: YMapsNS | null = null;

  return {
    async mount(container, opts) {
      const yns = await loadYmaps(opts.lang);
      ns = yns;
      map = new yns.Map(
        container,
        {
          center: [opts.center.lat, opts.center.lon],
          zoom: opts.zoom,
          // свои кнопки зума рисуются в BranchMap, встроенные контролы не нужны
          controls: [],
        },
        { suppressMapOpenBlock: true },
      );
      if (opts.disableScrollZoom) map.behaviors.disable('scrollZoom');
      map.events.add('click', () => opts.onBackgroundClick());
    },

    destroy() {
      pins.forEach((p) => map?.geoObjects.remove(p));
      pins = [];
      if (userPin) map?.geoObjects.remove(userPin);
      userPin = null;
      map?.destroy();
      map = null;
      ns = null;
    },

    setMarkers(markers: MapDriverMarkerSpec[]) {
      if (!map || !ns) return;
      pins.forEach((p) => map!.geoObjects.remove(p));
      pins = markers.map((m) => {
        const pin = createHtmlPlacemark(
          ns!,
          [m.lat, m.lon],
          m.el,
          PIN_SIZE / 2 - m.offsetX,
          PIN_SIZE / 2 - m.offsetY,
          PIN_SIZE,
          m.zIndex,
          true,
        );
        // Клик — только через placemark.events: собственный прозрачный
        // events-pane ymaps лежит ПОВЕРХ панов с метками и перехватывает все
        // DOM-события, поэтому нативный listener на m.el не сработал бы никогда.
        pin.events.add('click', () => m.onClick?.());
        map!.geoObjects.add(pin);
        return pin;
      });
    },

    setUserMarker(pos, el) {
      if (userPin) {
        map?.geoObjects.remove(userPin);
        userPin = null;
      }
      if (!map || !ns || !pos || !el) return;
      userPin = createHtmlPlacemark(
        ns,
        [pos.lat, pos.lon],
        el,
        USER_DOT_SIZE / 2,
        USER_DOT_SIZE / 2,
        USER_DOT_SIZE,
        0,
        false,
      );
      map.geoObjects.add(userPin);
    },

    setCenter(center, zoom) {
      if (!map) return;
      const targetZoom = zoom !== undefined ? Math.max(map.getZoom(), zoom) : map.getZoom();
      map.setCenter([center.lat, center.lon], targetZoom, { duration: 500 });
    },

    fitBounds(points, paddingPx, maxZoom) {
      if (!map || points.length === 0) return;
      let minLat = Infinity;
      let minLon = Infinity;
      let maxLat = -Infinity;
      let maxLon = -Infinity;
      for (const p of points) {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLon = Math.min(minLon, p.lon);
        maxLon = Math.max(maxLon, p.lon);
      }
      map.setBounds(
        [
          [minLat, minLon],
          [maxLat, maxLon],
        ],
        // IMapBoundsOptions.zoomMargin у setBounds — только number[]/number[][],
        // голое число (в отличие от других мест API) не проходит по типам
        { checkZoomRange: true, zoomMargin: [paddingPx, paddingPx, paddingPx, paddingPx] },
      );
      if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
    },

    getZoom() {
      return map?.getZoom() ?? 0;
    },

    zoomTo(zoom) {
      map?.setZoom(zoom, { duration: 200 });
    },

    invalidateSize() {
      map?.container.fitToViewport();
    },
  };
}

export const yandexDriverModule: MapDriverModule = {
  id: 'yandex',
  label: 'Яндекс',
  // ключа не требует — единственный способ узнать, что провайдер реально
  // недоступен (скрипт заблокирован, домен упал), это попробовать mount()
  isConfigured: () => true,
  create: createYandexDriver,
};

export type { DriverPoint };
