import 'server-only';
import type { BestRate, RateStat } from '@/lib/domain';
import { mapBestRate, mapRateStat } from '../mappers';
import { serviceGet } from './departments';

export async function rateStatistics(depId: number): Promise<RateStat[]> {
  const raw = await serviceGet<unknown[]>(`/mobile/rates/statistics/${depId}`);
  return (raw ?? []).map((r) => mapRateStat(r as Parameters<typeof mapRateStat>[0]));
}

export async function bestRate(currency: string, city?: string): Promise<BestRate> {
  const qs = new URLSearchParams({ currency });
  if (city) qs.set('city', city);
  const raw = await serviceGet<unknown>(`/mobile/rates/best-rate?${qs}`);
  return mapBestRate(raw as Parameters<typeof mapBestRate>[0]);
}
