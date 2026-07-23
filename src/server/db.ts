import 'server-only';

import { randomUUID } from 'node:crypto';
import type {
  Booking,
  Branch,
  Competitor,
  Currency,
  FranchiseLead,
  NewsPost,
  Notification,
  Session,
  Subscription,
  User,
} from '@/lib/types';

/**
 * Мок-база в памяти процесса. Внешних API нет — это каркас, который можно
 * заменить на реальное хранилище, не трогая route handlers и UI.
 *
 * Данные-сиды перенесены из макета Figma (курсы 539/541.4, адрес пр. Достык 240,
 * пользователь «Фёдор Михайлович», список уведомлений и т.д.).
 */

type Db = {
  currencies: Currency[];
  competitors: Competitor[];
  branches: Branch[];
  users: User[];
  passwords: Map<string, string>;
  /** одноразовые коды подтверждения: email → код */
  codes: Map<string, string>;
  sessions: Map<string, Session>;
  bookings: Booking[];
  subscriptions: Subscription[];
  notifications: Notification[];
  news: NewsPost[];
  leads: FranchiseLead[];
  /** избранные валюты по пользователю (гость — ключ 'guest') */
  favorites: Map<string, Set<string>>;
};

const MARKET_RATE = 538.45;

function seed(): Db {
  const demoUser: User = {
    id: 'u-demo',
    email: 'ilya.random.7421@gmail.com',
    phone: '+7 (777) 019 63 44',
    firstName: 'Фёдор',
    lastName: '',
    middleName: 'Михайлович',
    iin: '',
    about: '',
    occupation: 'Я работаю в криптовалюте',
    tags: ['entrepreneur', 'investor'],
    address: 'пр. Достык, 240',
    avatar: '/img/avatar.png',
  };

  const now = Date.now();

  const notifications: Notification[] = [
    {
      id: 'n1',
      userId: demoUser.id,
      badges: ['booking30', 'number'],
      titleKey: 'bookedPair',
      createdAt: now - 60_000,
      read: false,
      archived: false,
      side: 'buy',
      amount: '550 (₸) : 1 ($)',
      address: 'пр. Достык, 240',
      bookingId: 'b1',
      actions: [],
    },
    {
      id: 'n2',
      userId: demoUser.id,
      badges: ['booking30', 'number'],
      titleKey: 'bookedPair',
      createdAt: now - 3_600_000,
      read: true,
      archived: false,
      side: 'buy',
      amount: '550 (₸) : 1 ($)',
      address: 'пр. Достык, 240',
      bookingId: 'b2',
      actions: [],
    },
    {
      id: 'n3',
      userId: demoUser.id,
      badges: ['rateAlert'],
      titleKey: 'alertsOn',
      createdAt: now - 7_200_000,
      read: true,
      archived: false,
      side: 'sell',
      amount: '550 (₸) : 1 ($)',
      actions: [],
    },
    {
      id: 'n4',
      userId: demoUser.id,
      badges: ['rateAlert'],
      titleKey: 'alertsOff',
      createdAt: now - 10_800_000,
      read: true,
      archived: false,
      side: 'buy',
      amount: '550 (₸) : 1 ($)',
      actions: ['resume'],
    },
    {
      id: 'n5',
      userId: demoUser.id,
      badges: ['rateAlert'],
      titleKey: 'rateReached',
      createdAt: now - 14_400_000,
      read: true,
      archived: false,
      side: 'buy',
      amount: '550 (₸) : 1 ($)',
      actions: ['individual', 'book'],
    },
    {
      id: 'n6',
      userId: demoUser.id,
      badges: ['individual', 'number'],
      titleKey: 'offerReviewed',
      createdAt: now - 86_400_000,
      read: true,
      archived: true,
      side: 'buy',
      amount: '500 000 (₸) : 1 010 ($)',
      actions: [],
    },
  ];

  const bookings: Booking[] = [
    {
      id: 'b1',
      userId: demoUser.id,
      type: 'booking',
      status: 'active',
      from: 'KZT',
      to: 'USD',
      amount: 500_000,
      result: 928.59,
      rate: MARKET_RATE,
      banknotes: 'small',
      branchId: 'br1',
      side: 'buy',
      phone: '+7 705 805 95 95',
      name: 'Фёдор Михайлович',
      maskedNumber: '7 704 *** ** 84',
      createdAt: now - 60_000,
      expiresAt: now + 29 * 60_000 + 59_000,
    },
    {
      id: 'b2',
      userId: demoUser.id,
      type: 'booking',
      status: 'cancelled',
      from: 'KZT',
      to: 'USD',
      amount: 500_000,
      result: 928.59,
      rate: MARKET_RATE,
      banknotes: null,
      branchId: 'br1',
      side: 'buy',
      phone: '+7 705 805 95 95',
      name: 'Фёдор Михайлович',
      maskedNumber: '7 704 *** ** 84',
      createdAt: now - 3_600_000,
      expiresAt: null,
    },
  ];

  return {
    currencies: [
      { code: 'USD', nameKey: 'usd', flag: 'us', buy: 539, sell: 541.4, primary: true, marketRate: MARKET_RATE },
      { code: 'EUR', nameKey: 'eur', flag: 'eu', buy: 539, sell: 541.4, primary: true, marketRate: MARKET_RATE },
      { code: 'RUB', nameKey: 'rub', flag: 'ru', buy: 539, sell: 541.4, primary: true, marketRate: MARKET_RATE },
      { code: 'CNY', nameKey: 'cny', flag: 'cn', buy: 539, sell: 541.4, primary: true, marketRate: MARKET_RATE },
      { code: 'GOLD', nameKey: 'gold', flag: 'gold', buy: 539, sell: 541.4, primary: true, marketRate: MARKET_RATE },
      { code: 'GBP', nameKey: 'gbp', flag: 'gb', buy: 539, sell: 541.4, primary: false, marketRate: MARKET_RATE },
      { code: 'AED', nameKey: 'aed', flag: 'ae', buy: 539, sell: 541.4, primary: false, marketRate: MARKET_RATE },
      { code: 'TRY', nameKey: 'try', flag: 'tr', buy: 539, sell: 541.4, primary: false, marketRate: MARKET_RATE },
      { code: 'UZS', nameKey: 'uzs', flag: 'uz', buy: 539, sell: 541.4, primary: false, marketRate: MARKET_RATE },
      { code: 'KGS', nameKey: 'kgs', flag: 'kg', buy: 539, sell: 541.4, primary: false, marketRate: MARKET_RATE },
    ],
    competitors: [
      { id: 'c1', nameKey: 'blue', color: 'var(--color-competitor-3)', buy: 539, sell: 541.4 },
      { id: 'c2', nameKey: 'green', color: 'var(--color-competitor-2)', buy: 539, sell: 541.4 },
      { id: 'c3', nameKey: 'red', color: 'var(--color-competitor-1)', buy: 539, sell: 541.4 },
    ],
    branches: [
      { id: 'br1', address: 'пр. Достык, 240', distanceKm: 4.3, buy: 539, sell: 541.4, badges: ['best', 'happyHours'], opensAt: '08:00', closesAt: '20:00', isOpen: true, point: { x: 0.64, y: 0.27 } },
      { id: 'br2', address: 'пр. Достык, 240', distanceKm: 3.2, buy: 539, sell: 541.4, badges: [], opensAt: '08:00', closesAt: '20:00', isOpen: true, point: { x: 0.42, y: 0.2 } },
      { id: 'br3', address: 'пр. Достык, 240', distanceKm: 4.9, buy: 539, sell: 541.4, badges: [], opensAt: '08:00', closesAt: '20:00', isOpen: true, point: { x: 0.83, y: 0.42 } },
      { id: 'br4', address: 'пр. Достык, 240', distanceKm: 5.2, buy: 539, sell: 541.4, badges: [], opensAt: '08:00', closesAt: '20:00', isOpen: false, point: { x: 0.2, y: 0.55 } },
      { id: 'br5', address: 'пр. Достык, 240', distanceKm: 2.9, buy: 539, sell: 541.4, badges: ['nearest'], opensAt: '08:00', closesAt: '20:00', isOpen: true, point: { x: 0.27, y: 0.62 } },
      { id: 'br6', address: 'пр. Достык, 240', distanceKm: 449.2, buy: 539, sell: 541.4, badges: [], opensAt: '08:00', closesAt: '20:00', isOpen: true, point: { x: 0.95, y: 0.78 } },
    ],
    users: [demoUser],
    passwords: new Map([[demoUser.email, 'ecash2026']]),
    codes: new Map(),
    sessions: new Map(),
    bookings,
    subscriptions: [],
    notifications,
    news: [
      { id: 'p1', slug: 'travelers', image: '/img/news-travelers.png', key: 'travelers', publishedAt: now - 172_800_000 },
      { id: 'p2', slug: 'city-dwellers', image: '/img/news-city.png', key: 'cityDwellers', publishedAt: now - 259_200_000 },
      { id: 'p3', slug: 'city-dwellers-2', image: '/img/news-city.png', key: 'cityDwellers', publishedAt: now - 345_600_000 },
    ],
    leads: [],
    favorites: new Map([['guest', new Set(['USD'])]]),
  };
}

/**
 * Синглтон переживает hot-reload дев-сервера: иначе при каждом
 * изменении файла сессии и заявки сбрасывались бы.
 */
const globalForDb = globalThis as unknown as { __ecashDb?: Db };
export const db: Db = (globalForDb.__ecashDb ??= seed());

export const newId = () => randomUUID();
export const MARKET = MARKET_RATE;
