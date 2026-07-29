import 'server-only';

/**
 * Нарушение уникальности в Postgres. Ловим по коду, а не по тексту: сообщение
 * зависит от локали сервера БД. postgres.js кладёт SQLSTATE в поле `code`.
 */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === '23505';
}
