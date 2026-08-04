import 'server-only';
import type { BestRate, RateStat } from '@/lib/domain';
import { cachedUpstream } from '../cache';
import { mapBestRate, mapRateStat } from '@/shared/ecash/mappers';
import { serviceGet } from './departments';

/**
 * Курсы общие для всех посетителей — короткий серверный TTL размазывает
 * тысячи одновременных пользователей в один апстрим-запрос на окно.
 * 20/30 секунд заведомо короче staleTime клиента (60 с): свежесть данных
 * для пользователя не меняется, меняется только нагрузка на апстрим.
 */
const RATES_TTL_MS = 20_000;
const BEST_TTL_MS = 30_000;

export function rateStatistics(depId: number): Promise<RateStat[]> {
  return cachedUpstream(`rates:${depId}`, RATES_TTL_MS, async () => {
    const raw = await serviceGet<unknown[]>(`/mobile/rates/statistics/${depId}`);
    return (raw ?? []).map((r) => mapRateStat(r as Parameters<typeof mapRateStat>[0]));
  });
}

export function bestRate(currency: string, city?: string): Promise<BestRate> {
  return cachedUpstream(`best:${currency}:${city ?? ''}`, BEST_TTL_MS, async () => {
    const qs = new URLSearchParams({ currency });
    if (city) qs.set('city', city);
    const raw = await serviceGet<unknown>(`/mobile/rates/best-rate?${qs}`);
    return mapBestRate(raw as Parameters<typeof mapBestRate>[0]);
  });
}
