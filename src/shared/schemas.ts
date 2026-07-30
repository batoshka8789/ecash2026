import { z } from 'zod';
import { DEFAULT_IMAGE_FOCUS, IMAGE_FOCUS } from '@/lib/domain';

/**
 * Схемы валидации входа BFF — единственный источник правды по контракту
 * наших route handlers. Сообщения — ключи i18n `errors.*`, поэтому ответ
 * с ошибкой поля клиент показывает через useErrorText без доп. маппинга.
 *
 * Формы валидируют ввод сами (свои сообщения — те же ключи `errors.*`),
 * чтобы не платить сетевым раундтрипом за опечатку; сервер остаётся
 * обязательной проверкой и не доверяет клиенту.
 */

// ------------------------------------------------------------------ телефон

/** ≥10 цифр после чистки; upstream нормализует формат сам. */
export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/[^\d+]/g, ''))
  .refine((s) => s.replace(/\D/g, '').length >= 10, 'errors.phoneRequired');

export const iinSchema = z.string().regex(/^\d{12}$/, 'errors.iinInvalid');

/** Логин: телефон или ИИН (12 цифр — это и валидный ИИН, и валидный телефон без кода). */
export const loginValueSchema = z
  .string()
  .trim()
  .min(1, 'errors.required')
  .transform((s) => s.replace(/[\s()-]/g, ''));

export const passwordSchema = z
  .string()
  .min(8, 'errors.passwordMin')
  .regex(/\d/, 'errors.passwordDigit');

export const otpSchema = z.string().regex(/^\d{6}$/, 'errors.codeInvalid');

// --------------------------------------------------------------------- auth

export const loginBody = z.object({
  login: loginValueSchema,
  password: z.string().min(1, 'errors.required'),
});

export const registerBody = z
  .object({
    phoneNumber: phoneSchema,
    otp: otpSchema,
    password: passwordSchema,
    password2: z.string(),
    iin: iinSchema.optional(),
  })
  .refine((d) => d.password === d.password2, {
    message: 'errors.passwordMatch',
    path: ['password2'],
  });

export const otpSendBody = z.object({
  phoneNumber: phoneSchema,
  purpose: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

export const otpConfirmBody = otpSendBody.extend({ otp: otpSchema });

export const otpLoginBody = z.object({
  phoneNumber: phoneSchema,
  otp: otpSchema,
  deviceId: z.string().max(64).optional(),
});

export const otpResetBody = z
  .object({
    phoneNumber: phoneSchema,
    otp: otpSchema,
    newPassword: passwordSchema,
    newPassword2: z.string(),
  })
  .refine((d) => d.newPassword === d.newPassword2, {
    message: 'errors.passwordMatch',
    path: ['newPassword2'],
  });

// ------------------------------------------------------------------- заявки

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{2,8}$/, 'errors.CURRENCY_REQUIRED');

export const createRequestBody = z
  .object({
    currencyFrom: currencyCodeSchema,
    currencyTo: currencyCodeSchema,
    /** сумма в валюте отдачи */
    value: z.number().positive('errors.amountRequired').finite(),
    rate: z.number().positive('errors.rateRequired').finite(),
    /** сумма в тенге */
    amount: z.number().positive('errors.amountRequired').finite(),
    depId: z.number().int().positive().optional(),
    kassaId: z.number().int().positive().optional(),
    fullName: z.string().trim().max(120).optional(),
    comment: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.currencyFrom !== d.currencyTo, {
    message: 'errors.CURRENCY_INVALID',
    path: ['currencyTo'],
  })
  .refine((d) => d.depId != null || d.kassaId != null, {
    message: 'errors.DEPARTMENT_REQUIRED',
    path: ['depId'],
  });

export const cancelRequestBody = z.object({
  comment: z.string().trim().max(500).optional(),
});

export const listRequestsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ------------------------------------------------------------------ профиль

export const profilePatchBody = z.object({
  avatar: z.string().max(300).nullable().optional(),
  displayName: z.string().max(80).optional(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  middleName: z.string().max(80).optional(),
  about: z.string().max(1000).optional(),
  occupation: z.string().max(120).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  address: z.string().max(300).optional(),
});

// ------------------------------------------------------------------ новости

export const localeSchema = z.enum(['ru', 'en', 'kk', 'zh']);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'errors.slugInvalid');

export const newsTranslationSchema = z.object({
  title: z.string().trim().min(1, 'errors.titleRequired').max(200),
  /** пустой — выжимка выводится из body автоматически */
  excerpt: z.string().trim().max(400).default(''),
  /**
   * JSON-документ редактора (см. src/lib/richtext-doc.ts); сервер только
   * хранит, не рендерит. Лимит выше, чем видимый текст: та же статья в
   * Tiptap JSON занимает намного больше байт, чем занимала markdown-строкой.
   */
  body: z.string().max(120_000).default(''),
});

/**
 * Локали перечислены явно, а не через record: так в типе закодировано,
 * что обязателен только русский, а остальные языки опциональны.
 */
export const newsTranslationsSchema = z.object({
  ru: newsTranslationSchema,
  en: newsTranslationSchema.optional(),
  kk: newsTranslationSchema.optional(),
  zh: newsTranslationSchema.optional(),
});

/** В PATCH переводы сливаются по локалям; null удаляет язык (кроме ru). */
export const newsTranslationsPatch = z.object({
  ru: newsTranslationSchema.optional(),
  en: newsTranslationSchema.nullable().optional(),
  kk: newsTranslationSchema.nullable().optional(),
  zh: newsTranslationSchema.nullable().optional(),
});

const imageFocusSchema = z.enum(IMAGE_FOCUS);

export const newsCreateBody = z.object({
  /** не задан — сервер сгенерирует из русского заголовка */
  slug: slugSchema.optional(),
  translations: newsTranslationsSchema,
  image: z.string().trim().max(300).default(''),
  imageFocus: imageFocusSchema.default(DEFAULT_IMAGE_FOCUS),
  status: z.enum(['draft', 'published']).default('draft'),
});

export const newsPatchBody = z.object({
  slug: slugSchema.optional(),
  translations: newsTranslationsPatch.optional(),
  image: z.string().trim().max(300).optional(),
  imageFocus: imageFocusSchema.optional(),
  status: z.enum(['draft', 'published']).optional(),
});

/**
 * Запрос на машинный перевод. Поля приходят из редактора как есть — сервер
 * не читает их из базы: переводить надо ровно то, что сейчас на экране,
 * включая несохранённые правки.
 */
export const newsTranslateBody = z.object({
  from: localeSchema.default('ru'),
  to: z.array(localeSchema).min(1).max(4),
  fields: z.object({
    title: z.string().trim().max(200),
    excerpt: z.string().trim().max(400).default(''),
    body: z.string().max(120_000).default(''),
  }),
});

export const adminNewsQuery = z.object({
  status: z.enum(['draft', 'published', 'all']).default('all'),
  q: z.string().trim().max(100).optional(),
});

export const publicNewsQuery = z.object({
  locale: localeSchema.default('ru'),
});

// ---------------------------------------------------------------- наш слой

export const favoriteToggleBody = z.object({ code: currencyCodeSchema });

export const rateAlertBody = z
  .object({
    currencyFrom: currencyCodeSchema,
    currencyTo: currencyCodeSchema,
    targetRate: z.number().positive('errors.rateRequired').finite(),
    /** ISO-дата окончания подписки; должна быть в будущем */
    until: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), 'errors.dateRequired')
      .refine((s) => Date.parse(s) > Date.now(), 'errors.dateInPast'),
  })
  .refine((d) => d.currencyFrom !== d.currencyTo, {
    message: 'errors.CURRENCY_INVALID',
    path: ['currencyTo'],
  });

export const franchiseLeadBody = z.object({
  name: z.string().trim().min(1, 'errors.nameRequired').max(120),
  phone: phoneSchema,
  city: z.string().trim().max(80).optional(),
  funds: z.string().trim().max(200).optional(),
  experience: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});

export type LoginBody = z.infer<typeof loginBody>;
export type RegisterBody = z.infer<typeof registerBody>;
export type CreateRequestBody = z.infer<typeof createRequestBody>;
export type ProfilePatchBody = z.infer<typeof profilePatchBody>;
export type RateAlertBody = z.infer<typeof rateAlertBody>;
