import { notFound } from 'next/navigation';

/**
 * Catch-all для неизвестных путей внутри локали: без него Next отдаёт
 * встроенную английскую 404 без шапки и переводов. Здесь же срабатывает
 * локализованный not-found.tsx сегмента [locale].
 */
export default function CatchAllNotFound(): never {
  notFound();
}
