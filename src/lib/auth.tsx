'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { User } from './types';

type AuthValue = {
  user: User | null;
  loading: boolean;
  authed: boolean;
  setUser: (u: User | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  authed: false,
  setUser: () => {},
  refresh: async () => {},
  logout: async () => {},
});

/** Сессия пользователя из мок-бэкенда (httpOnly-кука + /api/auth/me). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api.auth.me();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { user: u } = await api.auth.me();
        if (alive) setUser(u);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, authed: Boolean(user), setUser, refresh, logout }),
    [user, loading, refresh, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export const useAuth = () => useContext(AuthContext);
