import type {
  Booking,
  Branch,
  Competitor,
  Currency,
  CurrencyCode,
  FranchiseLead,
  NewsPost,
  Notification,
  Subscription,
  User,
} from './types';

/** Ошибка запроса с кодом поля — чтобы форма подсветила нужный инпут. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly field?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json', ...init?.headers } : init?.headers,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? 'errors.unknown', data?.field, res.status);
  }
  return data as T;
}

const post = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: 'POST', body: payload ? JSON.stringify(payload) : undefined });

/** Единая точка доступа к мок-бэкенду. Внешних API нет. */
export const api = {
  rates: () =>
    request<{
      marketRate: number;
      currencies: Currency[];
      competitors: Competitor[];
      favorites: string[];
    }>('/rates'),

  toggleFavorite: (code: CurrencyCode) => post<{ favorites: string[] }>('/favorites', { code }),

  branches: (sort?: 'distance') =>
    request<{ branches: Branch[] }>(`/branches${sort ? `?sort=${sort}` : ''}`),

  news: () => request<{ posts: NewsPost[] }>('/news'),

  auth: {
    me: () => request<{ user: User | null }>('/auth/me'),
    login: (login: string, password: string) => post<{ user: User }>('/auth/login', { login, password }),
    signup: (email: string, password: string, password2: string) =>
      post<{ email: string; devCode: string }>('/auth/signup', { email, password, password2 }),
    verify: (email: string, code: string, phone?: string) =>
      post<{ user: User }>('/auth/verify', { email, code, phone }),
    recovery: (payload: {
      step: 'request' | 'confirm' | 'reset';
      email: string;
      code?: string;
      password?: string;
      password2?: string;
    }) => post<{ sent?: boolean; devCode?: string; confirmed?: boolean; reset?: boolean }>('/auth/recovery', payload),
    logout: () => post<{ ok: true }>('/auth/logout'),
  },

  profile: {
    get: () => request<{ user: User }>('/profile'),
    save: (patch: Partial<User>) =>
      request<{ user: User }>('/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
  },

  bookings: {
    list: () => request<{ bookings: Booking[] }>('/bookings'),
    create: (payload: {
      type: 'booking' | 'individual';
      from: CurrencyCode;
      to: CurrencyCode;
      amount: number;
      banknotes: 'small' | 'large' | null;
      branchId: string;
      side: 'buy' | 'sell';
      phone: string;
      name: string;
    }) => post<{ booking: Booking }>('/bookings', payload),
    cancel: (id: string) => request<{ booking: Booking }>(`/bookings/${id}`, { method: 'DELETE' }),
  },

  notifications: {
    list: (tab: 'actual' | 'history') =>
      request<{ notifications: Notification[]; unread: number; bookings: Booking[] }>(
        `/notifications?tab=${tab}`,
      ),
    markAllRead: () => post<{ ok: true }>('/notifications'),
  },

  subscriptions: {
    list: () => request<{ subscriptions: Subscription[] }>('/subscriptions'),
    create: (payload: {
      from: CurrencyCode;
      to: CurrencyCode;
      targetRate: number;
      day: string;
      month: string;
      year: string;
    }) => post<{ subscription: Subscription }>('/subscriptions', payload),
  },

  franchiseLead: (payload: { name: string; phone: string; city?: string }) =>
    post<{ lead: FranchiseLead }>('/franchise-leads', payload),
};
