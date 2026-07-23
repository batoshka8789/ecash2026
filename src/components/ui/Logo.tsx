/* eslint-disable @next/next/no-img-element */

import { clsx } from 'clsx';

/**
 * Логотип ecash — оригинальный артворк из макета (image ref d64f5891).
 *
 * В Figma один и тот же PNG перекрашивается масками под тему, поэтому здесь
 * лежат два готовых варианта: `logo-dark` со светлым «cash» для тёмного фона
 * и `logo-light` с исходным тёмно-серым для светлого.
 *
 * По умолчанию вариант выбирается по data-theme. На лендинге тема
 * форсирована тёмной, поэтому там передаётся tone="onDark" — иначе при
 * светлой теме сайта на тёмном лендинге оказался бы тёмный логотип.
 *
 * Пропорция артворка 571×190; в макете логотип 106.49×40.
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

  if (tone === 'onDark') {
    return (
      <span className={clsx('block h-10 w-[106px] shrink-0', className)}>
        <img
          src="/img/logo-dark.png"
          alt="ecash exchange"
          width={571}
          height={190}
          className={base}
        />
      </span>
    );
  }

  return (
    <span className={clsx('block h-10 w-[106px] shrink-0', className)}>
      <img
        src="/img/logo-dark.png"
        alt="ecash exchange"
        width={571}
        height={190}
        className={clsx(base, "[:root[data-theme='light']_&]:hidden")}
      />
      <img
        src="/img/logo-light.png"
        alt=""
        aria-hidden
        width={571}
        height={190}
        className={clsx(base, "hidden [:root[data-theme='light']_&]:block")}
      />
    </span>
  );
}
