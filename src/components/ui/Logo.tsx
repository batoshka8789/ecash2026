/* eslint-disable @next/next/no-img-element */

import { clsx } from 'clsx';

/**
 * Логотип ecash — оригинальный артворк из макета (image ref d64f5891, 615×231),
 * взятый из .fig побайтово и не обрезанный: в макете рамка логотипа
 * 106.49×40 (237:7815), пропорция картинки ровно та же, поэтому она заполняет
 * рамку целиком, без полей.
 *
 * Тему макет делает не вторым файлом, а масками поверх той же картинки:
 * mask group 237:7817 и 237:7820 заливают «cash» и «exchange» цветом #EEEEEE.
 * Поэтому тёмный вариант — тот же артворк с перекрашенным в #EEEEEE словесным
 * знаком (целиком, а не двумя оттенками), светлый — исходный #434343/#787878.
 *
 * По умолчанию вариант выбирается по data-theme. На лендинге тема форсирована
 * тёмной, поэтому там передаётся tone="onDark".
 */
export function Logo({
  className,
  tone = 'auto',
}: {
  className?: string;
  /** auto — по теме сайта, onDark — всегда светлый вариант */
  tone?: 'auto' | 'onDark';
}) {
  const base = 'h-full w-full object-contain object-left';
  const box = 'block h-10 w-[106.49px] shrink-0';

  if (tone === 'onDark') {
    return (
      <span className={clsx(box, className)}>
        <img
          src="/img/logo-dark.png"
          alt="ecash exchange"
          width={615}
          height={231}
          className={base}
        />
      </span>
    );
  }

  return (
    <span className={clsx(box, className)}>
      <img
        src="/img/logo-dark.png"
        alt="ecash exchange"
        width={615}
        height={231}
        className={clsx(base, "[:root[data-theme='light']_&]:hidden")}
      />
      <img
        src="/img/logo-light.png"
        alt=""
        aria-hidden
        width={615}
        height={231}
        className={clsx(base, "hidden [:root[data-theme='light']_&]:block")}
      />
    </span>
  );
}
