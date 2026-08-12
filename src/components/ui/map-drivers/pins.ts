import { clsx } from 'clsx';
import type { BranchMapBadgeTone, BranchMapMarker } from './types';

const badgeTone: Record<BranchMapBadgeTone, string> = {
  best: 'bg-brand',
  happyHours: 'bg-additional-2',
  nearest: 'bg-additional-3',
};

/** Пиксельный размер пина (h-12 w-12 ниже) — нужен обоим драйверам для anchor/offset. */
export const PIN_SIZE = 48;
/** Пиксельный размер точки пользователя (h-4 w-4 ниже). */
export const USER_DOT_SIZE = 16;

/**
 * Пин отделения по макету: брендовый круг 40×40 с белым знаком ecash и
 * подписью-бейджем сверху. Кликабельная область — 48×48 (минимум для тапа),
 * сам круг остаётся 40×40. Один и тот же DOM-узел уходит в любой драйвер —
 * визуал не должен зависеть от того, 2GIS сейчас или Yandex.
 */
export function makePin(marker: BranchMapMarker): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.title = marker.label;
  el.setAttribute('aria-label', marker.label);
  // Стабильный крючок для e2e: узел один на все драйверы, а классы у
  // Yandex/2GIS-обвязки свои и меняются с версиями их SDK.
  el.dataset.testid = 'map-pin';
  el.className =
    'relative flex h-12 w-12 cursor-pointer items-center justify-center border-0 bg-transparent p-0';

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
export function makeUserDot(label: string): HTMLDivElement {
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
export function spiderfy(markers: BranchMapMarker[]): Map<number, [number, number]> {
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
