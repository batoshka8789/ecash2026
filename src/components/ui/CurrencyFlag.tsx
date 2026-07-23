import { clsx } from 'clsx';

/**
 * Флаг валюты — скруглённый прямоугольник как в макете.
 * Для золота (GOLD) — золотистая текстура градиентом.
 */
export function CurrencyFlag({
  flag,
  className,
}: {
  flag: string;
  className?: string;
}) {
  if (flag === 'gold') {
    return (
      <span
        aria-hidden
        className={clsx('inline-block overflow-hidden rounded-lg', className)}
        style={{
          background:
            'radial-gradient(120% 120% at 20% 15%, #f6e27a 0%, #cb9b2c 40%, #8a6a1c 75%, #b98d2f 100%)',
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={clsx(`fi fi-${flag} !bg-cover overflow-hidden rounded-lg`, className)}
    />
  );
}
