'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api';

type QueryState<T> = { data: T | null; loading: boolean; error: string | null };

/**
 * Загрузка данных с состояниями.
 * `fetcher` должен быть стабильным (useCallback у вызывающего) — он же
 * служит зависимостью перезагрузки. Состояние меняется только после await,
 * чтобы не дёргать setState синхронно внутри эффекта.
 */
export function useQuery<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await fetcher();
        if (alive) setState({ data, loading: false, error: null });
      } catch (e) {
        const error = e instanceof Error ? e.message : 'errors.unknown';
        if (alive) setState({ data: null, loading: false, error });
      }
    })();

    return () => {
      alive = false;
    };
  }, [fetcher]);

  /** Точечное обновление данных — для оптимистичных изменений в UI. */
  const setData = useCallback((update: (prev: T | null) => T | null) => {
    setState((s) => ({ ...s, data: update(s.data) }));
  }, []);

  return { ...state, setData };
}

/** Отправка формы: busy-флаг и ошибка с указанием поля. */
export function useMutation<Args extends unknown[], T>(fn: (...args: Args) => Promise<T>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<T | null> => {
      setBusy(true);
      setError(null);
      setField(null);
      try {
        return await fn(...args);
      } catch (e) {
        if (e instanceof ApiError) {
          setError(e.message);
          setField(e.field ?? null);
        } else {
          setError('errors.unknown');
        }
        return null;
      } finally {
        setBusy(false);
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    setError(null);
    setField(null);
  }, []);

  return { run, busy, error, field, reset };
}
