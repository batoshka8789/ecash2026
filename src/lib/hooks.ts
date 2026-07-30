'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { secondsLeft } from './time';

/** Общий секундный тикер для всех таймеров страницы. */
function subscribeTick(onTick: () => void): () => void {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

/**
 * Обратный отсчёт до ISO-срока по СЕРВЕРНОМУ времени (см. lib/time.ts).
 * useSyncExternalStore: остаток пересчитывается от serverNow() на каждом
 * тике — сон ноутбука или смена системных часов не ломают таймер,
 * потому что значение всегда выводится заново, а не декрементируется.
 */
export function useCountdown(untilIso: string | null): number {
  const getSnapshot = useCallback(() => secondsLeft(untilIso), [untilIso]);
  return useSyncExternalStore(subscribeTick, getSnapshot, getSnapshot);
}

/** Секундный таймер вниз от N — для «Повторная отправка через …». */
export function useResendTimer(): [number, (sec: number) => void] {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return [left, setLeft];
}
