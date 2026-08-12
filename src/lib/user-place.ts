'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGuestAddress } from '@/components/layout/AddressDropdown';
import { useAuth } from './auth';
import { api } from './api';
import { nearestBranch, useBranchPoints, type BranchPoint } from './branch-points';

/**
 * «Мой адрес» как точка на карте: сохранённый адрес (профиль у
 * авторизованного, localStorage у гостя) геокодируется через BFF.
 * Из этой точки по всему сайту считается ближайшее отделение: курсы
 * на главной, отделение брони по умолчанию, бейдж «Рядом с вами».
 */
export function useUserPlace() {
  const { account, authed } = useAuth();
  const guestAddress = useGuestAddress();
  const address = ((authed ? account?.profile.address : guestAddress) ?? '').trim();

  // Частый случай: адрес выбран из подсказок и дословно совпадает с адресом
  // отделения — координаты берём у отделения, без внешнего геокодера
  // (сырые капслок-адреса Ecash Nominatim всё равно не понимает).
  const { points } = useBranchPoints({ enabled: address.length >= 4 });
  const matched = useMemo(() => {
    const needle = address.toLowerCase();
    if (!needle) return null;
    return points.find((p) => p.address.trim().toLowerCase() === needle) ?? null;
  }, [address, points]);

  const geo = useQuery({
    queryKey: ['geocode', address.toLowerCase()],
    queryFn: ({ signal }) => api.geocode(address, signal),
    enabled: address.length >= 4 && !matched,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  });

  const coords = matched ? { lat: matched.lat, lon: matched.lon } : (geo.data?.point ?? null);

  return {
    address,
    coords,
    /** адрес есть, но координаты ещё грузятся */
    resolving: address.length >= 4 && !matched && geo.isPending,
  };
}

/**
 * Ближайшее к «Моему адресу» отделение. Пока адреса нет — ПЕРВОЕ отделение
 * из живого списка.
 *
 * Раньше здесь стояло `fallback = 1`, и то же число дублировалось в
 * четырёх компонентах. На дев-контуре Ecash отделение №1 существует
 * («Гранд Парк»), но это совпадение: на боевом контуре такого id может не
 * быть вовсе или он может принадлежать другому отделению — и курсы,
 * калькулятор, бронь и подписка молча остались бы пустыми. Никаких
 * предположений о конкретных id в коде больше нет.
 *
 * `null` = список ещё не загружен; вызывающий обязан отключить свой запрос
 * (`enabled: depId != null`), иначе уйдёт запрос с несуществующим отделением.
 */
export function useNearestDepId(opts?: { enabled?: boolean }): {
  depId: number | null;
  resolved: boolean;
} {
  const { coords } = useUserPlace();
  const { points, loading } = useBranchPoints({ enabled: opts?.enabled ?? true });

  const depId = useMemo(() => {
    if (points.length === 0) return null;
    if (coords) {
      const nearest: BranchPoint | null = nearestBranch(points, coords);
      if (nearest) return nearest.depId;
    }
    // Список приходит от Ecash в его же порядке — первый элемент и есть
    // разумное «отделение по умолчанию», каким бы ни был контур.
    return points[0].depId;
  }, [coords, points]);

  return { depId, resolved: !loading };
}
