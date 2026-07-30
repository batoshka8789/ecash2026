import type {
  AccountWithProfile,
  BestRate,
  CurrencyCode,
  Department,
  DepartmentInfo,
  ExchangeRequest,
  ImageFocus,
  Locale,
  NewsAdminPost,
  NewsPost,
  NewsStatus,
  NewsTranslations,
  OperationsPage,
  RateAlert,
  RateStat,
} from './domain';
import { noteServerTime } from './time';

/** Ошибка запроса: code — ключ i18n, field — какой инпут подсветить. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly field?: string,
    readonly status?: number,
    /** полезная нагрузка — напр. существующая заявка при REQUEST_ALREADY_EXISTS */
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init ?? {};
  const signal = rest.signal
    ? AbortSignal.any([rest.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      signal,
      headers: rest.body ? { 'content-type': 'application/json', ...rest.headers } : rest.headers,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new ApiError('errors.timeout', undefined, 0);
    }
    throw new ApiError('errors.network', undefined, 0);
  }

  noteServerTime(res.headers.get('x-server-time'));

  const isJson = res.headers.get('content-type')?.includes('application/json') ?? false;
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(
      (data?.error as string) ?? httpFallback(res.status),
      data?.field as string | undefined,
      res.status,
      data?.data,
    );
  }
  if (data === null) throw new ApiError('errors.unknown', undefined, res.status);
  return data as T;
}

function httpFallback(status: number): string {
  if (status === 401) return 'errors.unauthorized';
  if (status === 404) return 'errors.notFound';
  if (status === 429) return 'errors.tooManyRequests';
  if (status >= 500) return 'errors.serverError';
  return 'errors.unknown';
}

const post = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: 'POST', body: payload !== undefined ? JSON.stringify(payload) : '{}' });

/**
 * Единая точка доступа к данным: браузер ходит ТОЛЬКО на свой origin (`/api/*`).
 *
 * Прямых запросов в api-dev.quiq.kz из браузера больше нет. CORS-белый список
 * Ecash привязан к origin буквально и содержит только `https://ecash.kz` и
 * `http://localhost:3000`, поэтому на любом другом домене — включая стенд на
 * Railway — preflight отвечал без `Access-Control-Allow-Origin`, и отделения с
 * курсами просто исчезали с экрана. Единственный способ не зависеть от чужого
 * белого списка — забирать эти данные на сервере, где CORS не действует.
 *
 * Заодно сервисный токен перестал попадать в браузер: раньше он выдавался
 * ручкой `/api/ecash-token`, чтобы JS мог подписать прямой запрос.
 */
export const api = {
  departments: {
    list: (signal?: AbortSignal) => request<{ departments: Department[] }>('/departments', { signal }),
    info: (depId: number, signal?: AbortSignal) =>
      request<{ department: DepartmentInfo }>(`/departments/${depId}`, { signal }),
  },

  rates: {
    /**
     * Курсы отделения одним составным ответом: курсы Ecash + курс НБ РК +
     * избранное. Склейка живёт на сервере (`/api/rates`), потому что
     * остальные части браузеру недоступны — своя БД и чужой nationalbank.kz.
     */
    forDep: (depId: number, signal?: AbortSignal) =>
      request<{
        depId: number;
        /** курс НБ РК по USD — историческая совместимость */
        marketRate: number | null;
        /** «Курс на бирже» по каждой валюте отделения (НБ РК) */
        marketRates: Record<string, number>;
        rates: RateStat[];
        favorites: string[];
      }>(`/rates?depId=${depId}`, { signal }),
    history: (
      params: { depId: number; code: CurrencyCode; period: 'day' | 'week' | 'month' | 'year' },
      signal?: AbortSignal,
    ) =>
      request<{
        depId: number;
        code: CurrencyCode;
        period: string;
        current: { buy: number; sell: number; change: number } | null;
        points: { t: string; buy: number; sell: number }[];
      }>(`/rates/history?depId=${params.depId}&code=${params.code}&period=${params.period}`, {
        signal,
      }),
    best: (currency: CurrencyCode, city?: string, signal?: AbortSignal) =>
      request<{ best: BestRate }>(
        `/rates/best?currency=${currency}${city ? `&city=${encodeURIComponent(city)}` : ''}`,
        { signal },
      ),
  },

  toggleFavorite: (code: CurrencyCode) => post<{ favorites: string[] }>('/favorites', { code }),

  /** Лента: сервер сам выбирает перевод по локали и падает на русский. */
  news: (locale: Locale, signal?: AbortSignal) =>
    request<{ posts: NewsPost[] }>(`/news?locale=${locale}`, { signal }),

  newsBySlug: (slug: string, locale: Locale, signal?: AbortSignal) =>
    request<{ post: NewsPost }>(`/news/${encodeURIComponent(slug)}?locale=${locale}`, { signal }),

  admin: {
    news: {
      list: (params: { status?: NewsStatus | 'all'; q?: string } = {}, signal?: AbortSignal) => {
        const qs = new URLSearchParams();
        if (params.status && params.status !== 'all') qs.set('status', params.status);
        if (params.q) qs.set('q', params.q);
        const tail = qs.toString();
        return request<{ posts: NewsAdminPost[] }>(`/admin/news${tail ? `?${tail}` : ''}`, { signal });
      },
      get: (id: string, signal?: AbortSignal) =>
        request<{ post: NewsAdminPost }>(`/admin/news/${id}`, { signal }),
      create: (payload: {
        slug?: string;
        translations: NewsTranslations;
        image?: string;
        imageFocus?: ImageFocus;
        status?: NewsStatus;
      }) => post<{ post: NewsAdminPost }>('/admin/news', payload),
      update: (
        id: string,
        payload: {
          slug?: string;
          translations?: NewsTranslations;
          image?: string;
          imageFocus?: ImageFocus;
          status?: NewsStatus;
        },
      ) =>
        request<{ post: NewsAdminPost }>(`/admin/news/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
      remove: (id: string) =>
        request<{ ok: true }>(`/admin/news/${id}`, { method: 'DELETE' }),
    },
    /**
     * Машинный перевод новости. Отправляем то, что сейчас в редакторе,
     * включая несохранённые правки — сервер в базу за текстом не ходит.
     */
    translate: (
      payload: {
        from: Locale;
        to: Locale[];
        fields: { title: string; excerpt: string; body: string };
      },
      signal?: AbortSignal,
    ) =>
      request<{
        translations: Partial<Record<Locale, { title: string; excerpt: string; body: string }>>;
        failed: Partial<Record<Locale, string>>;
      }>('/admin/translate', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal,
      }),

    /**
     * Загрузка обложки: файл уходит сырым телом, а не JSON-ом, поэтому мимо
     * общего post() — там тело всегда сериализуется.
     */
    uploadImage: (file: File, signal?: AbortSignal) =>
      request<{ media: { id: string; url: string; width: number; height: number; size: number } }>(
        '/admin/media',
        { method: 'POST', body: file, headers: { 'content-type': file.type }, signal },
      ),
  },

  auth: {
    me: (signal?: AbortSignal) =>
      request<{ account: AccountWithProfile | null }>('/auth/me', { signal }),
    login: (login: string, password: string) =>
      post<{ account: AccountWithProfile }>('/auth/login', { login, password }),
    register: (payload: {
      phoneNumber: string;
      otp: string;
      password: string;
      password2: string;
      iin?: string;
    }) => post<{ account: AccountWithProfile }>('/auth/register', payload),
    logout: () => post<{ ok: true }>('/auth/logout'),
    otp: {
      send: (phoneNumber: string, purpose: 0 | 1 | 2) =>
        post<{
          phoneNumber: string;
          ttlSeconds: number;
          resendAfterSeconds: number;
          digits: number;
          devCode?: string;
        }>('/auth/otp/send', { phoneNumber, purpose }),
      login: (phoneNumber: string, otp: string) =>
        post<{ account: AccountWithProfile }>('/auth/otp/login', { phoneNumber, otp }),
      resetPassword: (payload: {
        phoneNumber: string;
        otp: string;
        newPassword: string;
        newPassword2: string;
      }) => post<{ reset: boolean }>('/auth/otp/reset-password', payload),
    },
  },

  profile: {
    save: (patch: {
      avatar?: string | null;
      displayName?: string;
      firstName?: string;
      lastName?: string;
      middleName?: string;
      about?: string;
      occupation?: string;
      tags?: string[];
      address?: string;
    }) =>
      request<{ profile: AccountWithProfile['profile'] }>('/profile', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
  },

  requests: {
    list: (page = 1, pageSize = 20, signal?: AbortSignal) =>
      request<OperationsPage>(`/requests?page=${page}&pageSize=${pageSize}`, { signal }),
    get: (id: number, signal?: AbortSignal) =>
      request<{ request: ExchangeRequest }>(`/requests/${id}`, { signal }),
    create: (payload: {
      currencyFrom: CurrencyCode;
      currencyTo: CurrencyCode;
      value: number;
      rate: number;
      amount: number;
      depId?: number;
      kassaId?: number;
      fullName?: string;
      comment?: string;
    }) => post<{ request: ExchangeRequest }>('/requests', payload),
    createIndividual: (payload: {
      currencyFrom: CurrencyCode;
      currencyTo: CurrencyCode;
      value: number;
      rate: number;
      amount: number;
      depId?: number;
      kassaId?: number;
      fullName?: string;
      comment?: string;
    }) => post<{ request: ExchangeRequest }>('/requests/individual-rate', payload),
    cancel: (id: number, comment?: string) =>
      post<{ request: ExchangeRequest }>(`/requests/${id}/cancel`, comment ? { comment } : {}),
    confirmIndividual: (id: number) =>
      post<{ request: ExchangeRequest }>(`/requests/${id}/individual-rate/confirm`),
    rejectIndividual: (id: number) =>
      post<{ request: ExchangeRequest }>(`/requests/${id}/individual-rate/reject`),
  },

  notifications: {
    list: (tab: 'actual' | 'history', signal?: AbortSignal) =>
      request<{
        notifications: NotificationDto[];
        unread: number;
        requests: ExchangeRequest[];
      }>(`/notifications?tab=${tab}`, { signal }),
  },

  rateAlerts: {
    list: (signal?: AbortSignal) => request<{ alerts: RateAlert[] }>('/rate-alerts', { signal }),
    create: (payload: {
      currencyFrom: CurrencyCode;
      currencyTo: CurrencyCode;
      targetRate: number;
      until: string;
    }) => post<{ alert: RateAlert }>('/rate-alerts', payload),
    remove: (id: string) => request<{ ok: true }>(`/rate-alerts/${id}`, { method: 'DELETE' }),
  },

  /** Геокодирование «Моего адреса» (BFF → OSM Nominatim); null — не нашли. */
  geocode: (q: string, signal?: AbortSignal) =>
    request<{ point: { lat: number; lon: number } | null }>(
      `/geocode?q=${encodeURIComponent(q)}`,
      { signal },
    ),

  franchiseLead: (payload: {
    name: string;
    phone: string;
    city?: string;
    funds?: string;
    experience?: string;
    tags?: string[];
  }) => post<{ lead: { id: string; createdAt: string } }>('/franchise-leads', payload),
};

export type NotificationDto = {
  id: string;
  badges: string[];
  titleKey: string;
  createdAt: string | null;
  side: 'buy' | 'sell';
  amount: string;
  /** пара валют — определяет, какие два флага показать в бейдже строки */
  currencyFrom: CurrencyCode;
  currencyTo: CurrencyCode;
  requestId: number | null;
  reservedUntil: string | null;
  needsClientConfirmation: boolean;
  phase: string;
  actions: string[];
  alertId: string | null;
};
