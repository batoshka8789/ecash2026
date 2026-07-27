import {
  boolean,
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

export const news = pgTable('news', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  image: text('image').notNull(),
  /** ключ переводов messages.news.<key>.* */
  key: text('key').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});

export const competitors = pgTable('competitors', {
  id: text('id').primaryKey(),
  nameKey: text('name_key').notNull(),
  color: text('color').notNull(),
  buy: numeric('buy', { precision: 14, scale: 4 }).notNull(),
  sell: numeric('sell', { precision: 14, scale: 4 }).notNull(),
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
