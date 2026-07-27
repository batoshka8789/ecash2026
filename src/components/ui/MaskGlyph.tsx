/**
 * Одноцветный глиф из альфа-маски (public/img/actions/*.png) — пиксели
 * взяты НАПРЯМУЮ из PNG-экспортов макета (8x для ретины): кастомные
 * глифы дизайнера, которых нет ни в одном шрифтовом/векторном наборе.
 * Красится background-цветом (currentColor), поэтому темы работают
 * как обычно. w/h — размер глифа в CSS-пикселях, 1:1 с экспортом.
 */
export function MaskGlyph({
  src,
  w,
  h,
  className,
}: {
  src: string;
  /** фиксированный размер в px; вместо него можно задать размер className-ом */
  w?: number;
  h?: number;
  className?: string;
}) {
  const url = `url(${src})`;
  return (
    <span
      aria-hidden
      className={className ? `block bg-current ${className}` : 'block bg-current'}
      style={{
        width: w,
        height: h,
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
