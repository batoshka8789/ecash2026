import 'server-only';
import { ecashFetch } from '../http';

/**
 * Пользовательская аутентификация. Login — телефон или ИИН
 * (телефон нормализуется на бэкенде, формат любой).
 */

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

export const login = (loginValue: string, password: string) =>
  ecashFetch<AuthTokens>('/mobile/auth/login', {
    method: 'POST',
    body: { login: loginValue, password },
  });

export const register = (phoneNumber: string, password: string, iin?: string) =>
  ecashFetch<AuthTokens>('/mobile/auth/register', {
    method: 'POST',
    body: { phoneNumber, password, ...(iin ? { iin } : {}) },
  });

export const refreshTokens = (refreshToken: string) =>
  ecashFetch<AuthTokens>('/mobile/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });

export const logout = (accessToken: string) =>
  ecashFetch<void>('/mobile/auth/logout', { method: 'POST', token: accessToken, body: {} });
