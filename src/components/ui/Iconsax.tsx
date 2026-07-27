/**
 * Иконки Iconsax (vuesax) — родной набор макета Figma. Material Symbols
 * покрывает большинство мест, но там, где пользовательские PNG-экспорты из
 * макета показали заметно другие глифы (нав-панель действий, блок отделения),
 * используем точные вектора из пакета iconsax-react (path-данные перенесены
 * 1:1, viewBox 0 0 24 24; linear — stroke, bold — fill, всё currentColor).
 */

const ICONS: Record<string, React.ReactNode> = {

  /* -------------------------------------------- linear (контурные) */
  bank: (
    <>
      <path
        d="m12.37 2.15 9 3.6c.35.14.63.56.63.93V10c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1V6.68c0-.37.28-.79.63-.93l9-3.6c.2-.08.54-.08.74 0ZM22 22H2v-3c0-.55.45-1 1-1h18c.55 0 1 .45 1 1v3ZM4 18v-7M8 18v-7M12 18v-7M16 18v-7M20 18v-7M1 22h22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  clock: (
    <>
      <path
        d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m15.71 15.18-3.1-1.85c-.54-.32-.98-1.09-.98-1.72v-4.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  location: (
    <>
      <path d="M12 13.43a3.12 3.12 0 1 0 0-6.24 3.12 3.12 0 0 0 0 6.24Z" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.62 8.49c1.97-8.66 14.8-8.65 16.76.01 1.15 5.08-2.01 9.38-4.78 12.04a5.193 5.193 0 0 1-7.21 0c-2.76-2.66-5.92-6.97-4.77-12.05Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </>
  ),
  map: (
    <>
      <path d="M9.148 7.488c-.56 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1Z" fill="currentColor" />
      <path
        d="M21.46 5.04C20.62 3.09 18.77 2 16.19 2H7.81C4.6 2 2 4.6 2 7.81v8.38c0 2.58 1.09 4.43 3.04 5.27.19.08.41.03.55-.11L21.35 5.59c.15-.15.2-.37.11-.55Zm-10.93 7.2c-.39.38-.9.56-1.41.56-.51 0-1.02-.19-1.41-.56C6.69 11.28 5.57 9.75 6 7.93c.38-1.65 1.84-2.39 3.12-2.39s2.74.74 3.12 2.4c.42 1.81-.7 3.34-1.71 4.3ZM19.469 20.53c.22.22.19.58-.08.73-.88.49-1.95.74-3.2.74h-8.38c-.29 0-.41-.34-.21-.54l6.04-6.04c.2-.2.51-.2.71 0l5.12 5.11ZM22.002 7.809v8.38c0 1.25-.25 2.33-.74 3.2-.15.27-.51.29-.73.08l-5.12-5.12c-.2-.2-.2-.51 0-.71l6.04-6.04c.21-.2.55-.08.55.21Z"
        fill="currentColor"
      />
    </>
  ),
  copy: (
    <>
      <path
        d="M16 12.9v4.2c0 3.5-1.4 4.9-4.9 4.9H6.9C3.4 22 2 20.6 2 17.1v-4.2C2 9.4 3.4 8 6.9 8h4.2c3.5 0 4.9 1.4 4.9 4.9Z"
        fill="currentColor"
      />
      <path
        d="M17.1 2h-4.2C9.817 2 8.37 3.094 8.07 5.739c-.064.553.395 1.011.952 1.011H11.1c4.2 0 6.15 1.95 6.15 6.15v2.078c0 .557.457 1.015 1.01.952C20.907 15.63 22 14.183 22 11.1V6.9C22 3.4 20.6 2 17.1 2Z"
        fill="currentColor"
      />
    </>
  ),
  'routing-2': (
    <>
      <path
        d="M5.47 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16.97 15h3c1.1 0 2 .9 2 2v3c0 1.1-.9 2-2 2h-3c-1.1 0-2-.9-2-2v-3c0-1.1.9-2 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 5h2.68c1.85 0 2.71 2.29 1.32 3.51L8.01 15.5C6.62 16.71 7.48 19 9.32 19H12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.486 5.5h.012M18.486 18.5h.012"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  call: (
    <path
      d="M21.97 18.33c0 .36-.08.73-.25 1.09-.17.36-.39.7-.68 1.02-.49.54-1.03.93-1.64 1.18-.6.25-1.25.38-1.95.38-1.02 0-2.11-.24-3.26-.73s-2.3-1.15-3.44-1.98a28.75 28.75 0 0 1-3.28-2.8 28.414 28.414 0 0 1-2.79-3.27c-.82-1.14-1.48-2.28-1.96-3.41C2.24 8.67 2 7.58 2 6.54c0-.68.12-1.33.36-1.93.24-.61.62-1.17 1.15-1.67C4.15 2.31 4.85 2 5.59 2c.28 0 .56.06.81.18.26.12.49.3.67.56l2.32 3.27c.18.25.31.48.4.7.09.21.14.42.14.61 0 .24-.07.48-.21.71-.13.23-.32.47-.56.71l-.76.79c-.11.11-.16.24-.16.4 0 .08.01.15.03.23.03.08.06.14.08.2.18.33.49.76.93 1.28.45.52.93 1.05 1.45 1.58.54.53 1.06 1.02 1.59 1.47.52.44.95.74 1.29.92.05.02.11.05.18.08.08.03.16.04.25.04.17 0 .3-.06.41-.17l.76-.75c.25-.25.49-.44.72-.56.23-.14.46-.21.71-.21.19 0 .39.04.61.13.22.09.45.22.7.39l3.31 2.35c.26.18.44.39.55.64.1.25.16.5.16.78Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
    />
  ),
};

export type IconsaxName = keyof typeof ICONS;

export function Iconsax({
  name,
  size = 24,
  className,
}: {
  name: IconsaxName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}
