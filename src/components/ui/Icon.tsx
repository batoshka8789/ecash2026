import { clsx } from 'clsx';

type IconProps = {
  name: string;
  /** Размер в px (ширина строки иконки). По умолчанию 24. */
  size?: number;
  filled?: boolean;
  className?: string;
};

/** Иконка Material Symbols Rounded — набор, использованный в макете. */
export function Icon({ name, size = 24, filled = false, className }: IconProps) {
  return (
    <span
      aria-hidden
      className={clsx('material-symbols-rounded select-none leading-none', className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}
