'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

// navigator.onLine врёт во встроенных браузерах и за VPN: один ложный
// offline замораживал все запросы. BFF на своём же домене — сеть решает fetch.
if (typeof window !== 'undefined') {
  onlineManager.setEventListener(() => () => {});
  onlineManager.setOnline(true);
}
import { api } from './api';
import type { AccountWithProfile } from './domain';

/**
 * Провайдер данных (TanStack Query) + сессия пользователя.
 * Сессия ревалидируется по фокусу окна — протухший токен обнаруживается
 * без перезагрузки страницы.
 */

type AuthValue = {
  account: AccountWithProfile | null;
  loading: boolean;
  authed: boolean;
  /** обновить сессию после входа/выхода/сохранения профиля */
  invalidate: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  account: null,
  loading: true,
  authed: false,
  invalidate: async () => {},
  logout: async () => {},
});

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // не ретраим клиентские ошибки (4xx) — только сеть и 5xx
          const status = (error as { status?: number }).status ?? 0;
          if (status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: true,
        // BFF на том же домене: navigator.onLine врёт (VPN, встроенные
        // браузеры) и замораживал бы приложение «paused»-запросами.
        // При реальном обрыве fetch упадёт сам и сработает retry/ошибка.
        networkMode: 'always',
      },
      mutations: {
        networkMode: 'always',
      },
    },
  });
}

let browserClient: QueryClient | undefined;
const getQueryClient = () => {
  browserClient ??= makeQueryClient();
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    // отладочный доступ к кэшу запросов в dev
    (window as unknown as { __qc?: QueryClient }).__qc = browserClient;
  }
  return browserClient;
};

function SessionProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: ({ signal }) => api.auth.me(signal),
    staleTime: 60_000,
  });

  const invalidate = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
  }, [qc]);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    qc.setQueryData(['auth', 'me'], { account: null });
    // личные данные не должны пережить выход
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
  }, [qc]);

  const account = data?.account ?? null;
  const value = useMemo<AuthValue>(
    () => ({ account, loading: isPending, authed: Boolean(account), invalidate, logout }),
    [account, isPending, invalidate, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

export const useAuth = () => useContext(AuthContext);
