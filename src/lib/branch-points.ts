'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/** Отделение с координатами — годится и для пина на карте, и для поиска ближайшего. */
export type BranchPoint = {
  depId: number;
  address: string;
  lat: number;
  lon: number;
};

/**
 * Отделения с координатами одним запросом.
 *
 * Координаты Ecash отдаёт только в карточке отделения, списком — нет. Раньше
 * этот разворот делался здесь: список, а следом по запросу на каждое
 * отделение. На дев-контуре получалось 16 запросов браузер→сервер на каждой
 * странице с картой или выбором отделения. Теперь разворачивает сервер
 * (`/api/departments/points`), а обращения к Ecash закрыты его кешем.
 *
 * lat/lon в апстриме перепутаны местами — нормализуются на сервере,
 * см. `src/server/ecash/coerce.ts`.
 */
export function useBranchPoints(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;

  const q = useQuery({
    queryKey: ['departmentsDetails'],
    queryFn: ({ signal }) => api.departments.details(signal),
    staleTime: 5 * 60_000,
    enabled,
  });

  // отделения без координат на карту не попадают — пин ставить некуда
  const points = useMemo<BranchPoint[]>(
    () =>
      (q.data?.departments ?? []).flatMap((d) =>
        d.coords
          ? [{ depId: d.depId, address: d.address, lat: d.coords.lat, lon: d.coords.lon }]
          : [],
      ),
    [q.data],
  );

  return { points, loading: q.isLoading };
}

const EARTH_KM = 6371;

/** Расстояние по большому кругу, км. */
function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  // min(1, …) — страховка от выхода за домен asin на округлении
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Ближайшее к точке отделение; null — если точек нет. */
export function nearestBranch(points: BranchPoint[], from: { lat: number; lon: number }) {
  let best: BranchPoint | null = null;
  let bestKm = Infinity;
  for (const p of points) {
    const km = haversineKm(from, p);
    if (km < bestKm) {
      bestKm = km;
      best = p;
    }
  }
  return best;
}

export type GeolocateStatus = 'idle' | 'pending' | 'denied' | 'unsupported' | 'empty';

/**
 * «Найти меня»: геолокация браузера → ближайшее отделение в `onFound`.
 * Запрос инициирует только пользователь — без явного действия браузер
 * и не спросит разрешение. Ответ приходит асинхронно, поэтому колбэк и точки
 * держим в ref (`locate` не пересоздаётся), а после размонтирования
 * состояние не трогаем.
 */
export function useGeolocate(points: BranchPoint[], onFound: (p: BranchPoint) => void) {
  const [status, setStatus] = useState<GeolocateStatus>('idle');
  /** Найденная позиция пользователя — для синей точки на карте (`userPos`). */
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);

  const foundRef = useRef(onFound);
  const pointsRef = useRef(points);
  const aliveRef = useRef(true);

  useEffect(() => {
    foundRef.current = onFound;
    pointsRef.current = points;
  }, [onFound, points]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    setStatus('pending');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!aliveRef.current) return;
        const me = { lat: coords.latitude, lon: coords.longitude };
        setPosition(me);
        const nearest = nearestBranch(pointsRef.current, me);
        if (!nearest) {
          setStatus('empty');
          return;
        }
        foundRef.current(nearest);
        setStatus('idle');
      },
      () => {
        // отказ, таймаут, недоступность — для пользователя это одно и то же
        if (aliveRef.current) setStatus('denied');
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const reset = useCallback(() => setStatus('idle'), []);

  return { locate, status, reset, position };
}
