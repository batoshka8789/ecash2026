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
 * Ближайшее к «Моему адресу» отделение; пока адреса/координат нет —
 * fallback (исторически отделение №1). enabled=false не грузит точки
 * там, где они не нужны немедленно.
 */
export function useNearestDepId(fallback = 1, opts?: { enabled?: boolean }) {
  const { coords } = useUserPlace();
  const { points, loading } = useBranchPoints({ enabled: opts?.enabled ?? true });

  const depId = useMemo(() => {
    if (!coords || points.length === 0) return fallback;
    const nearest: BranchPoint | null = nearestBranch(points, coords);
    return nearest?.depId ?? fallback;
  }, [coords, points, fallback]);

  return { depId, resolved: !loading };
}
