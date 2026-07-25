/**
 * Доменные типы реального API Ecash Mobile. Формы проверены живыми
 * запросами к api-dev.quiq.kz; числовые статусы — из документации.
 * Старые мок-типы в types.ts удаляются по мере перевода экранов.
 */

// ------------------------------------------------------------------ валюты

/**
 * Открытый союз: API отдаёт 27 кодов, включая GOLD1…GOLD100, THB, VND…
 * Известные коды сохраняют автодополнение, остальные не ломают типизацию.
 */
export type CurrencyCode =
  | 'USD' | 'EUR' | 'RUB' | 'CNY' | 'GBP' | 'AED' | 'TRY' | 'UZS' | 'KGS' | 'KZT'
  | 'GOLD1' | 'GOLD5' | 'GOLD10' | 'GOLD20' | 'GOLD50' | 'GOLD100'
  | (string & {});

export type RateStat = {
  currencyCode: CurrencyCode;
  currencyName: string;
  buy: number;
  sell: number;
  change: number;
  history: RatePoint[];
};

export type RatePoint = { date: string; buy: number; sell: number };

export type DepartmentCurrency = {
  code: CurrencyCode;
  name: string;
  buy: number;
  sell: number;
  buyDiff: number;
  buyDiffDir: '+' | '-';
  sellDiff: number;
  sellDiffDir: '+' | '-';
  flagUrl: string | null;
};

export type BestRate = {
  city: string | null;
  currencyCode: CurrencyCode;
  bestBuy: { depId: number; address: string; rate: number } | null;
  bestSale: { depId: number; address: string; rate: number } | null;
};

// --------------------------------------------------------------- отделения

export type Department = {
  depId: number;
  code: string;
  address: string;
};

export type DepartmentInfo = Department & {
  name: string;
  city: string;
  /** нормализовано: своп перепутанных lat/lon, вне Казахстана → null */
  coords: { lat: number; lon: number } | null;
  timetable: { openTime: string; closeTime: string } | null;
  ratesUpdatedAt: string | null;
  currencies: DepartmentCurrency[];
};

// ------------------------------------------------------------------ аккаунт

export type Account = {
  accountId: string;
  phoneNumber: string;
  /** без связи с ядровым клиентом бронь всё равно работает, clientId придёт позже */
  isLinkedToClient: boolean;
  clientId: number | null;
  iin: string | null;
  firstName: string;
  lastName: string;
  middleName: string;
};

/** Наш слой (БД): анкета, которой нет в API Ecash. */
export type Profile = {
  avatar: string | null;
  about: string;
  occupation: string;
  tags: string[];
  address: string;
};

export type AccountWithProfile = Account & { profile: Profile };

// ------------------------------------------------------------------ заявки

/** 0 Введен · 8 Забронирована · 1 Проведена · 3 Отмена */
export type RequestStatus = 0 | 1 | 3 | 8;
/** 0 заведена · 1 назначена · 2 подтверждена · 3 отказ */
export type AcceptStatus = 0 | 1 | 2 | 3;
/** 1 резервирование · 2 индивидуальный курс */
export type AcceptActionType = 1 | 2;
export type OperationSide = 'buy' | 'sell';

/** Производная фаза — единственное место ветвления UI. */
export type RequestPhase = 'pending' | 'held' | 'done' | 'cancelled';

export type RequestAccept = {
  acceptId: number;
  actionType: AcceptActionType;
  actionTypeName: string;
  status: AcceptStatus;
  statusName: string;
  rate: number | null;
  amount: number | null;
  value: number | null;
  createdAt: string | null;
  answeredAt: string | null;
};

export type RequestHistoryEntry = {
  updatedAt: string | null;
  oldStatus: RequestStatus;
  oldStatusName: string;
  status: RequestStatus;
  statusName: string;
  action: string;
  rate: number | null;
  value: number | null;
  amount: number | null;
};

export type ExchangeRequest = {
  requestId: number;
  status: RequestStatus;
  statusName: string;
  phase: RequestPhase;
  /** индивидуальный курс согласован, ждём решения клиента (60 мин) */
  needsClientConfirmation: boolean;
  clientId: number | null;
  currencyFrom: CurrencyCode;
  currencyTo: CurrencyCode;
  value: number;
  rate: number;
  amount: number;
  /** правило API: currencyFrom !== 'KZT' → buy (покупка у клиента) */
  actionType: OperationSide;
  depId: number | null;
  kassaId: number | null;
  isReserve: boolean;
  isIndividual: boolean;
  reserveMinutes: number;
  reservedAt: string | null;
  reservedUntil: string | null;
  isExpired: boolean;
  acceptStatus: AcceptStatus | null;
  acceptComment: string | null;
  /** Комментарий клиента при оформлении — сюда уходит выбранный тип купюр. */
  comment: string | null;
  treasurerLogin: string | null;
  printedTicket: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  accepts: RequestAccept[];
  history: RequestHistoryEntry[];
};

export type OperationsPage = {
  accountId: string;
  clientId: number | null;
  page: number;
  pageSize: number;
  total: number;
  requests: ExchangeRequest[];
};

// ------------------------------------------------------------ реальное время

export type RealtimeEventType =
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.cancelledByClient'
  | 'booking.expired'
  | 'request.rateApproved'
  | 'request.rateRejected'
  | 'request.rateAcceptedByClient'
  | 'request.rateDeclinedByClient'
  | 'rate.changed'
  | 'news';

export type RealtimeEvent = {
  type: RealtimeEventType;
  requestId?: number;
  status?: RequestStatus;
  statusName?: string;
  actionType?: OperationSide;
  currencyFrom?: CurrencyCode;
  currencyTo?: CurrencyCode;
  value?: number;
  rate?: number;
  amount?: number;
  acceptId?: number;
  acceptActionType?: AcceptActionType;
  acceptStatus?: AcceptStatus;
  needsClientConfirmation?: boolean;
  reservedUntil?: string;
  reserveMinutes?: number;
  message?: string;
  /** отметка нашего сервера — для коррекции расхождения часов */
  receivedAt: string;
};

// ------------------------------------------------------------------ наш слой

export type RateAlert = {
  id: string;
  currencyFrom: CurrencyCode;
  currencyTo: CurrencyCode;
  targetRate: number;
  until: string;
  active: boolean;
  createdAt: string;
};

export type NewsPost = {
  id: string;
  slug: string;
  image: string;
  /** ключи в messages.news.<key>.title / .text */
  key: string;
  publishedAt: string;
};

export type Competitor = {
  id: string;
  nameKey: string;
  color: string;
  buy: number;
  sell: number;
};
