import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { NewsTranslations } from '@/lib/domain';

/** Двоичные данные: в drizzle нет готового bytea, объявляем свой тип. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/**
 * Наш слой данных — то, чего нет в API Ecash и что документация относит
 * «в мобильный слой»: анкета, аватар, избранное, подписки, новости,
 * конкуренты, накопленная история курсов. Ключ всюду — accountId из
 * токена Ecash: своих пользователей мы не заводим.
 */

export const profiles = pgTable('profiles', {
  accountId: text('account_id').primaryKey(),
  avatar: text('avatar'),
  displayName: text('display_name').notNull().default(''),
  /** ФИО, введённое самим человеком. Ядро Ecash отдаёт своё только после
   *  привязки клиента в отделении — до этого поля пустые, и без нашего слоя
   *  профиль было физически нечем заполнить. */
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  middleName: text('middle_name').notNull().default(''),
  about: text('about').notNull().default(''),
  occupation: text('occupation').notNull().default(''),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  address: text('address').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const favorites = pgTable(
  'favorites',
  {
    accountId: text('account_id').notNull(),
    currencyCode: text('currency_code').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.currencyCode] })],
);

export const rateAlerts = pgTable(
  'rate_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: text('account_id').notNull(),
    currencyFrom: text('currency_from').notNull(),
    currencyTo: text('currency_to').notNull(),
    targetRate: numeric('target_rate', { precision: 14, scale: 4 }).notNull(),
    until: timestamp('until', { withTimezone: true }).notNull(),
    active: boolean('active').notNull().default(true),
    /** отметка срабатывания — чтобы не слать повторно */
    firedAt: timestamp('fired_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rate_alerts_account_idx').on(t.accountId)],
);

/**
 * Push-подписки браузеров. Одна строка — одно устройство (точнее, один
 * браузер): человек, открывший сайт с телефона и с ноутбука, получит
 * уведомление на оба.
 *
 * endpoint — это и адрес доставки, и естественный ключ: браузер выдаёт его
 * при подписке, и он же приходит обратно, если подписка протухла. Поэтому
 * первичный ключ по нему, а не по accountId: при повторной подписке того же
 * браузера строка обновляется, а не плодится.
 *
 * Ключи p256dh/auth выдаёт сам браузер — ими web-push шифрует полезную
 * нагрузку, чтобы сервис доставки (Google/Apple) не мог прочитать текст.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    endpoint: text('endpoint').primaryKey(),
    accountId: text('account_id').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    /** для диагностики: какой браузер/устройство, если подписка вдруг падает */
    userAgent: text('user_agent').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('push_subscriptions_account_idx').on(t.accountId)],
);

/**
 * Картинки новостей — байтами в БД, а не файлами на диске: Railway стирает
 * файловую систему при каждом деплое, поэтому загруженное в public/ не
 * пережило бы ни одной выкладки. Отдаются через /api/media/[id].
 */
export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** после нормализации всегда image/webp */
  mime: text('mime').notNull(),
  bytes: bytea('bytes').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  size: integer('size').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Новости. Контент лежит здесь целиком: раньше в строке был только ключ
 * перевода, а тексты — в messages/*.json, которые вшиваются в бандл на сборке,
 * поэтому опубликовать новость без деплоя было невозможно.
 */
export const news = pgTable('news', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  image: text('image').notNull(),
  /** видимая часть обложки при обрезке, формат CSS object-position */
  imageFocus: text('image_focus').notNull().default('50% 50%'),
  /** переводы по локалям; обязателен ru, он же фолбэк для остальных */
  translations: jsonb('translations').$type<NewsTranslations>().notNull().default({}),
  /** 'draft' | 'published' — публичный список отдаёт только опубликованные */
  status: text('status').notNull().default('draft'),
  /** legacy-ключ messages.news.<key>.*; у новых записей пуст */
  key: text('key'),
  authorAccountId: text('author_account_id'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Конкуренты для блока «Сравнить с конкурентами» на главной. Храним только
 * имя (ключ перевода) и цвет обводки: реального источника курсов конкурентов
 * нет ни в Ecash API, ни где-либо ещё, а числа в БД однажды уже превратились
 * в «фиксированный курс, который никогда не обновлялся». Курсы теперь
 * выводятся на лету из живого курса отделения — см. /api/rates.
 */
export const competitors = pgTable('competitors', {
  id: text('id').primaryKey(),
  nameKey: text('name_key').notNull(),
  color: text('color').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Снапшоты курсов раз в 15 минут по каждому отделению — наша собственная
 * история для графика Сутки/Неделя/Месяц/Год: upstream history[] почти пуст
 * (проверено: данные есть только у depId 1).
 */
export const rateSnapshots = pgTable(
  'rate_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    depId: integer('dep_id').notNull(),
    currencyCode: text('currency_code').notNull(),
    buy: numeric('buy', { precision: 14, scale: 4 }).notNull(),
    sell: numeric('sell', { precision: 14, scale: 4 }).notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rate_snapshots_lookup_idx').on(t.depId, t.currencyCode, t.takenAt)],
);

export const franchiseLeads = pgTable('franchise_leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  city: text('city').notNull().default(''),
  /** доп. квалификация из формы «Связаться»: капитал, опыт, роль(и) */
  funds: text('funds').notNull().default(''),
  experience: text('experience').notNull().default(''),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
