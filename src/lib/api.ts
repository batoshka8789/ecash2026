import type {
  AccountWithProfile,
  Competitor,
  CurrencyCode,
  ExchangeRequest,
  ImageFocus,
  Locale,
  NewsAdminPost,
  NewsPost,
  NewsStatus,
  NewsTranslations,
  OperationsPage,
  RateAlert,
} from './domain';
import { noteServerTime } from './time';
import { ecashDirect } from './ecash-direct';

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
 * Единая точка доступа к данным.
 *
 * ВСЕ данные Ecash браузер берёт прямо с api-dev.quiq.kz — отделения, карточка
 * отделения, курсы отделения и лучший курс. Их CORS наш origin пускает, см.
 * README и ecash-direct.ts. Транзита через свой сервер у данных Ecash больше нет.
 *
 * Через свой сервер остаётся только то, чего у Ecash нет или что нельзя
 * отдавать браузеру:
 * • всё пользовательское — bearer лежит в httpOnly-куке, из JS не читается;
 * • наш слой данных — новости, избранное, подписки, конкуренты, история курсов;
 * • курс НБ РК — публичный XML с чужого домена nationalbank.kz;
 * • сервисный токен — выдаётся по clientSecret, который остаётся на сервере.
 */
export const api = {
  departments: {
    list: async (signal?: AbortSignal) => ({
      departments: await ecashDirect.depList(signal),
    }),
    info: async (depId: number, signal?: AbortSignal) => ({
      department: await ecashDirect.depInfo(depId, signal),
    }),
  },

  rates: {
    /**
     * Курсы отделения — НАПРЯМУЮ с api-dev.quiq.kz, наша добавка (курс НБ РК,
     * избранное, конкуренты) — отдельным запросом к своему серверу. Раньше это
     * был один составной ответ `/api/rates`, где курсы Ecash шли транзитом
     * через нас; теперь транзита нет. Форма результата не изменилась, поэтому
     * вызывающие экраны (калькулятор, список курсов, бронь, подписка)
     * трогать не пришлось.
     *
     * `marketRates` приходит целой картой НБ РК — сужаем её до валют этого
     * отделения, как было раньше, чтобы у экранов не поменялся контракт.
     */
    forDep: async (depId: number, signal?: AbortSignal) => {
      const [rates, meta] = await Promise.all([
        ecashDirect.rates(depId, signal),
        request<{
          marketRate: number | null;
          marketRates: Record<string, number>;
          favorites: string[];
          competitors: Competitor[];
        }>('/rates/meta', { signal }),
      ]);

      const marketRates: Record<string, number> = {};
      for (const r of rates) {
        const v = meta.marketRates[r.currencyCode.toUpperCase()];
        if (typeof v === 'number') marketRates[r.currencyCode] = v;
      }

      return {
        depId,
        /** курс НБ РК по USD — историческая совместимость */
        marketRate: meta.marketRate,
        /** «Курс на бирже» по каждой валюте отделения (НБ РК) */
        marketRates,
        rates,
        favorites: meta.favorites,
        competitors: meta.competitors,
      };
    },
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
    best: async (currency: CurrencyCode, city?: string, signal?: AbortSignal) => ({
      best: await ecashDirect.bestRate(currency, city, signal),
    }),
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
  requestId: number | null;
  reservedUntil: string | null;
  needsClientConfirmation: boolean;
  phase: string;
  actions: string[];
  alertId: string | null;
};
