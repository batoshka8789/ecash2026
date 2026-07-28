/**
 * Доменные типы ecash. Состав полей повторяет данные, показанные в макете,
 * поэтому UI не изобретает собственных структур.
 */

export type Locale = 'ru' | 'en' | 'kk' | 'zh';

// ------------------------------------------------------------------ курсы

export type CurrencyCode =
  | 'USD' | 'EUR' | 'RUB' | 'CNY' | 'GOLD'
  | 'GBP' | 'AED' | 'TRY' | 'UZS' | 'KGS' | 'KZT';

export type Currency = {
  code: CurrencyCode;
  /** ключ названия в messages: rates.currencies.<nameKey> */
  nameKey: string;
  /** класс flag-icons (fi-xx) либо 'gold' */
  flag: string;
  buy: number;
  sell: number;
  /** показывается до нажатия «Показать все валюты» */
  primary: boolean;
  /** курс биржи для пары с тенге */
  marketRate: number;
};

export type Competitor = {
  id: string;
  nameKey: string;
  /** CSS-переменная цвета обводки: competitor 1/2/3 из палитры */
  color: string;
  buy: number;
  sell: number;
};

// --------------------------------------------------------------- отделения

export type BranchBadge = 'best' | 'happyHours' | 'nearest';

export type Branch = {
  id: string;
  address: string;
  distanceKm: number;
  buy: number;
  sell: number;
  badges: BranchBadge[];
  opensAt: string;
  closesAt: string;
  isOpen: boolean;
  /** координаты для маркера на карте, доля от размеров картинки 0..1 */
  point: { x: number; y: number };
};

// ---------------------------------------------------------------- аккаунт

export type User = {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  middleName: string;
  iin: string;
  about: string;
  occupation: string;
  tags: string[];
  address: string;
  avatar: string;
};

export type Session = { userId: string; createdAt: number };

// ------------------------------------------------------------------ заявки

export type BookingType = 'booking' | 'individual';
export type BookingStatus = 'active' | 'cancelled' | 'review' | 'done';
export type OperationSide = 'buy' | 'sell';

export type Booking = {
  id: string;
  userId: string | null;
  type: BookingType;
  status: BookingStatus;
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number;
  result: number | null;
  rate: number;
  banknotes: 'small' | 'large' | null;
  branchId: string;
  side: OperationSide;
  phone: string;
  name: string;
  /** «Ваш номер: 7 704 *** ** 84» */
  maskedNumber: string;
  createdAt: number;
  /** до какого времени держится бронь (30 мин) */
  expiresAt: number | null;
};

export type Subscription = {
  id: string;
  userId: string | null;
  from: CurrencyCode;
  to: CurrencyCode;
  targetRate: number;
  until: string;
  active: boolean;
  createdAt: number;
};

// ------------------------------------------------------------ уведомления

export type NotificationBadge = 'booking30' | 'number' | 'rateAlert' | 'individual';

export type Notification = {
  id: string;
  userId: string;
  badges: NotificationBadge[];
  titleKey: string;
  createdAt: number;
  read: boolean;
  archived: boolean;
  side: OperationSide;
  amount: string;
  address?: string;
  /** id связанной брони — для таймера и статуса */
  bookingId?: string;
  actions: ('resume' | 'individual' | 'book')[];
};

// ----------------------------------------------------------------- прочее

export type NewsPost = {
  id: string;
  slug: string;
  image: string;
  /** ключи в messages.news.<key>.title / .text */
  key: string;
  publishedAt: number;
};

export type FranchiseLead = {
  id: string;
  name: string;
  phone: string;
  city: string;
  createdAt: number;
};

export type ApiError = { error: string; field?: string };
