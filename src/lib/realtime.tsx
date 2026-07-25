'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import type { RealtimeEvent } from './domain';

/**
 * Клиент реального времени: EventSource на /api/events.
 * События инвалидируют кэш запросов — карточка заявки и уведомления
 * обновляются мгновенно; при недоступности потока компоненты продолжают
 * работать на своём поллинге (refetchInterval).
 */

type RealtimeState = {
  /** поток жив — компоненты могут ослабить поллинг */
  connected: boolean;
  /** последнее событие — для точечных реакций (тосты) */
  lastEvent: RealtimeEvent | null;
};

const RealtimeContext = createContext<RealtimeState>({ connected: false, lastEvent: null });

const RETRY_BASE_MS = 3_000;
const RETRY_MAX_MS = 60_000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<RealtimeState>({ connected: false, lastEvent: null });
  const retryRef = useRef(RETRY_BASE_MS);

  useEffect(() => {
    if (!authed) return;

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const connect = () => {
      if (!alive) return;
      es = new EventSource('/api/events');

      es.addEventListener('ready', () => {
        retryRef.current = RETRY_BASE_MS;
        setState((s) => ({ ...s, connected: true }));
      });

      es.addEventListener('degraded', () => {
        // хаб Ecash недоступен: остаёмся на поллинге, поток не пересоздаём
        setState((s) => ({ ...s, connected: false }));
      });

      es.onmessage = (msg) => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse(msg.data);
        } catch {
          return;
        }
        if (!event.type) return;
        setState({ connected: true, lastEvent: event });

        // точечная инвалидация по типу события
        if (event.type.startsWith('booking.') || event.type.startsWith('request.')) {
          void qc.invalidateQueries({ queryKey: ['requests'] });
          void qc.invalidateQueries({ queryKey: ['notifications'] });
          if (event.requestId) {
            void qc.invalidateQueries({ queryKey: ['requests', 'detail', event.requestId] });
          }
        } else if (event.type === 'rate.changed') {
          void qc.invalidateQueries({ queryKey: ['rates'] });
        } else if (event.type === 'news') {
          void qc.invalidateQueries({ queryKey: ['news'] });
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        setState((s) => ({ ...s, connected: false }));
        if (!alive) return;
        retryTimer = setTimeout(connect, retryRef.current);
        retryRef.current = Math.min(retryRef.current * 2, RETRY_MAX_MS);
      };
    };

    connect();

    // bfcache держит страницу живой вместе с открытым EventSource —
    // зомби-страница съедает лимит соединений origin (HTTP/1.1: 6).
    // pagehide закрывает поток; при возврате из bfcache pageshow переподключит.
    const onPageHide = () => {
      es?.close();
      es = null;
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && alive && !es) connect();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      es?.close();
    };
  }, [authed, qc]);

  // для гостя поток не открывается — connected выводится, а не хранится
  const value: RealtimeState = authed ? state : { connected: false, lastEvent: null };
  return <RealtimeContext value={value}>{children}</RealtimeContext>;
}

export const useRealtime = () => useContext(RealtimeContext);
