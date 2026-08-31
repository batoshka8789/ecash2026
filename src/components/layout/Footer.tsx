import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';

/**
 * Футер сайта: контакты (соцсети + телефон) / график работы / документы,
 * ниже строка копирайта и ссылка на политику конфиденциальности.
 *
 * В макете футеров ДВА, и это разные компоненты, а не один адаптив:
 *
 *   • приложение — `footer` из «navigation» (мастер 847:49658, 1920×327):
 *     поля 80/360/100, колонка контента 1200, подписи 16 Medium disabled,
 *     значения 20 Bold, плитки соцсетей 42 r16. На 1024 и 768 тот же ряд,
 *     поля 60/52/80. Ниже 768 — вертикальная колонка, поля 24 (мастер
 *     1957:243918, 480×316), подписи 14, значения 16.
 *
 *   • лендинг франшизы — `footer` со страницы landing (2153:195406,
 *     1920×400): поля 100/360/60, значения 28 SemiBold, плитки 72 r28,
 *     на 768 (2153:195969) колонка по центру. Ниже 768 лендинг берёт тот
 *     же мобильный мастер, что и приложение, — там футеры совпадают.
 *
 * Отсюда variant: по умолчанию компактный футер приложения, лендинг просит
 * свой явно. Раньше крупный лендинговый вариант стоял на всех страницах —
 * оттого приложение и разъезжалось с макетом по размерам.
 *
 * Линия сверху и плитки соцсетей заданы токенами: в макете у лендинга
 * литеральные #303030 / #272626, светлой темы у него нет, а на белом футере
 * обе краски пропадают. Токены обязательны и по другой причине: лендинг
 * форсирует тёмную тему классом .theme-dark на своём контейнере, поэтому
 * переопределение через :root[data-theme='light'] сработало бы и на нём —
 * токены же переобъявлены внутри .theme-dark. У футера приложения линия
 * своя (переменная макета stroke/surface3): на #333333 разделитель лендинга
 * почти не виден, а в приложении он в макете читается.
 *
 * Ссылки на разделы сюда не добавляем — в макете их нет ни в шапке, ни в
 * футере (роль навигационного хаба играют карточки-действий, хлебные крошки
 * и сайдбар кабинета, см. Header.tsx). Переключатель языка — там же, в шапке.
 * Исключения — «Документы» (обязательная публикация лицензий, в макете стоит
 * именно здесь) и политика конфиденциальности: её в макете нет, но публикация
 * тоже обязательная, поэтому она уходит в строку копирайта — единственное
 * место, где ссылка не ломает высоту футера (327 на 1920). Обе ведут на
 * страницы сайта: /documents-license и /legal/privacy.
 */
export function Footer({
  className,
  variant = 'app',
}: {
  className?: string;
  variant?: 'app' | 'landing';
}) {
  const t = useTranslations('footer');
  const landing = variant === 'landing';

  // Подпись колонки: ниже 768 макеты совпадают (14/1.1, disabled), выше —
  // расходятся: приложение оставляет её приглушённой, лендинг поднимает
  // до 20 основным цветом.
  const caption = clsx(
    'text-sm leading-[1.1] text-text-disabled',
    landing
      ? 'md:text-xl md:leading-8 md:text-text-default'
      : 'md:text-base md:font-medium md:leading-[1.2]',
  );

  // Значение колонки: 16/20 до 768; дальше 20 Bold у приложения и 28 SemiBold
  // с отрицательным трекингом у лендинга.
  const value = clsx(
    'text-base leading-5 text-text-default',
    landing
      ? 'md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]'
      : 'md:text-xl md:font-bold md:leading-7',
  );

  // Колонка «подпись + значение»: зазор 8 везде, у лендинга он растёт до
  // 24 на 768 и 40 на 1024.
  const column = clsx(
    'flex flex-col gap-2',
    landing && 'md:items-center md:gap-6 lg:items-start lg:gap-10',
  );

  return (
    <footer
      className={clsx(
        'relative border-t bg-surface-modal-bg',
        landing ? 'border-footer-divider' : 'border-stroke-surface3',
        // отбивка сверху: у страниц приложения своя, лендинг передаёт ритм макета
        className ?? 'mt-10 sm:mt-16',
      )}
    >
      {/*
        Своя обёртка, а не Container: у футера колонка макета шире страничной
        и свои поля по брейкпоинтам. У приложения max-w 1304 = 1200 контента
        + поля 52, поэтому на 1920 боковой отступ выходит ровно 360 макета;
        у лендинга — 1448 + 124 по той же арифметике.
      */}
      <div
        className={clsx(
          'relative mx-auto w-full px-6 py-6',
          landing
            ? 'max-w-[1448px] md:px-5 md:py-[60px] lg:px-10 xl:px-[124px] xl:pt-[100px]'
            : 'max-w-[1304px] md:px-[52px] md:pb-20 md:pt-[60px] xl:pb-[100px] xl:pt-20',
        )}
      >
        {/* Приложение: ряд из трёх колонок уже с 768. Лендинг: до 1024 — одна
            центрированная колонка с зазором 60. */}
        <div
          className={clsx(
            'flex flex-col gap-6',
            landing
              ? 'md:items-center md:gap-[60px] lg:flex-row lg:items-center lg:justify-between lg:gap-10'
              : 'md:flex-row md:items-start md:justify-between md:gap-10',
          )}
        >
          <div
            className={clsx(
              'flex flex-col gap-2',
              landing && 'md:items-center md:gap-6 lg:items-start',
            )}
          >
            <div className={clsx('flex gap-2', landing && 'md:gap-4')}>
              <SocialLink href="https://wa.me/77003332223" label="WhatsApp" landing={landing}>
                {/* знак из набора макета (whatsApp.svg): кольцо обводкой,
                    трубка заливкой — поэтому fill/stroke заданы у путей,
                    а не у корня */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className={clsx('h-5 w-5', landing && 'md:h-8 md:w-8')}
                >
                  <path
                    d="M10.0635 0.760742C16.9873 -0.379913 22.9943 4.71458 23.3818 11.3262C23.7576 17.7248 18.4158 23.3973 11.9941 23.3975C9.88389 23.3975 7.91232 22.8278 6.22656 21.8369L6.00781 21.708L5.7627 21.7754L1.85156 22.8555L1.84766 22.8564C1.41177 22.9801 0.99405 22.5785 1.11523 22.124L1.11426 22.123L2.18262 18.1543L2.24707 17.9141L2.12305 17.6982C0.958651 15.6792 0.384565 13.2596 0.674805 10.6885L0.744141 10.1719C1.48429 5.41215 5.30441 1.54649 10.0635 0.760742Z"
                    stroke="currentColor"
                    strokeWidth="1.19984"
                  />
                  <path
                    d="M17.862 16.4622C17.754 16.6782 17.622 16.8822 17.454 17.0742C17.1541 17.3981 16.8301 17.6381 16.4701 17.7821C16.1102 17.938 15.7143 18.01 15.2943 18.01C14.6824 18.01 14.0225 17.8661 13.3386 17.5661C12.6426 17.2661 11.9588 16.8702 11.2749 16.3782C10.5789 15.8743 9.93101 15.3104 9.3071 14.6984C8.68318 14.0745 8.13122 13.4146 7.62728 12.7307C7.13535 12.0468 6.73942 11.3629 6.45146 10.679C6.1635 9.99505 6.01953 9.33515 6.01953 8.71123C6.01953 8.30328 6.09151 7.90733 6.23549 7.54738C6.37948 7.17543 6.60747 6.83948 6.93142 6.53951C7.31538 6.15556 7.7353 5.97559 8.17924 5.97559C8.34722 5.97559 8.51516 6.01158 8.67114 6.08357C8.82712 6.15556 8.97114 6.26354 9.07912 6.41952L10.4709 8.38725C10.5789 8.54323 10.6629 8.67522 10.7109 8.8072C10.7709 8.93918 10.7949 9.05917 10.7949 9.17915C10.7949 9.32313 10.7469 9.46713 10.6629 9.61111C10.5789 9.7551 10.4709 9.89906 10.3269 10.043L9.87099 10.523C9.799 10.595 9.77505 10.667 9.77505 10.763C9.77505 10.8109 9.787 10.8589 9.799 10.9069C9.823 10.9549 9.83504 10.9909 9.84704 11.0269C9.95503 11.2309 10.147 11.4828 10.4109 11.7948C10.6869 12.1068 10.9749 12.4307 11.2869 12.7427C11.6108 13.0667 11.9228 13.3546 12.2467 13.6306C12.5587 13.8945 12.8226 14.0745 13.0266 14.1825C13.0626 14.1945 13.0986 14.2185 13.1346 14.2305C13.1826 14.2545 13.2306 14.2545 13.2906 14.2545C13.3986 14.2545 13.4706 14.2185 13.5426 14.1465L13.9985 13.6906C14.1544 13.5346 14.2985 13.4266 14.4305 13.3546C14.5744 13.2706 14.7064 13.2226 14.8624 13.2226C14.9824 13.2226 15.1023 13.2466 15.2343 13.3066C15.3663 13.3666 15.5103 13.4386 15.6542 13.5466L17.646 14.9624C17.802 15.0704 17.91 15.2024 17.982 15.3464C18.0419 15.5024 18.078 15.6463 18.078 15.8143C18.006 16.0183 17.958 16.2462 17.862 16.4622Z"
                    fill="currentColor"
                  />
                </svg>
              </SocialLink>
              <SocialLink href="https://t.me/ecash" label="Telegram" landing={landing}>
                {/* знак из набора макета (telegram.svg) */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className={clsx('h-5 w-5', landing && 'md:h-8 md:w-8')}
                >
                  <path
                    d="M19.0416 21.8879C19.3137 21.912 19.5851 21.8328 19.8009 21.6662C20.0168 21.4997 20.1612 21.2581 20.2051 20.9901L23.9968 2.96542C24.0076 2.84925 23.9911 2.73216 23.9483 2.6235C23.9055 2.51485 23.8377 2.41765 23.7504 2.33966C23.5984 2.19639 23.3985 2.11402 23.1892 2.1084C23.1161 2.1084 15.5739 4.87897 0.562132 10.4201C0.392723 10.4738 0.245888 10.5816 0.144412 10.7267C0.0429359 10.8719 -0.00750904 11.0462 0.000904983 11.2227C0.0104581 11.3876 0.0726994 11.545 0.178567 11.6723C0.284433 11.7995 0.428401 11.8898 0.589509 11.9301L6.06489 13.617L8.26873 20.1875C8.32632 20.3665 8.44245 20.5213 8.59869 20.6273C8.75493 20.7333 8.94232 20.7843 9.1311 20.7724C9.23328 20.7721 9.33434 20.7514 9.42837 20.7117C9.5224 20.6721 9.60749 20.614 9.67864 20.5411L12.7859 17.6028L18.3845 21.6839C18.5796 21.8125 18.8075 21.8833 19.0416 21.8879ZM9.03529 18.5687L7.37898 13.1272C15.3365 8.09393 19.3427 5.57729 19.3975 5.57729C19.6028 5.57729 19.7123 5.57729 19.7123 5.79495C19.7169 5.82196 19.7169 5.84955 19.7123 5.87657C19.7123 5.87657 16.2765 9.00537 9.41856 15.127L9.03529 18.5687Z"
                    fill="currentColor"
                  />
                </svg>
              </SocialLink>
            </div>
            <a
              href="tel:+77003332223"
              className={clsx(value, 'transition-colors hover:text-text-brand')}
            >
              +7 (700) 333 22 23
            </a>
          </div>

          <div className={column}>
            <Caption landing={landing} className={caption}>
              {t('schedule')}
            </Caption>
            <div className={value}>{t('scheduleValue')}</div>
          </div>

          <div className={column}>
            <Caption landing={landing} className={caption}>
              {t('additional')}
            </Caption>
            {/* Единственная ссылка колонки — раздел лицензий по отделениям. */}
            <Link
              href="/documents-license"
              className={clsx(
                value,
                'inline-flex items-center gap-2.5 transition-colors hover:text-text-brand',
              )}
            >
              {t('documents')}
              <Icon name="arrow_outward" size={20} />
            </Link>
          </div>
        </div>

        {/*
          Нижняя строка: копирайт и политика. Зазор сверху 48 (у лендинга 80
          с 768). До 768 — друг под другом у левого края, дальше копирайт
          слева, политика справа: так строка остаётся одной и высота футера
          совпадает с макетом.
        */}
        <div
          className={clsx(
            'mt-12 flex flex-col gap-2 text-sm leading-[1.1] text-text-disabled',
            landing
              ? 'md:mt-20 md:items-center md:gap-3 md:text-center md:text-xl md:leading-8 md:text-text-default lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:text-left'
              : 'md:flex-row md:items-center md:justify-between md:gap-4 md:text-base md:leading-[1.24] lg:gap-10',
          )}
        >
          <div className={clsx(!landing && 'md:whitespace-nowrap')}>
            © {new Date().getFullYear()}. {t('rights')}
          </div>
          {/* Раньше отсюда открывался PDF из public/documents. Теперь это
              страница сайта (/legal/privacy) с тем же текстом: документ
              читают чаще всего с телефона, и чужой просмотрщик, в котором
              А4 разводят пальцами, для этого не годится. Сам файл никуда не
              делся — он лежит кнопкой «Скачать» в шапке той страницы.

              На 768 колонка контента всего 664 — политика в 16 туда не встаёт
              рядом с копирайтом и ломает строку (а с ней и высоту футера),
              поэтому до 1024 держим её на ступень мельче. */}
          <Link
            href="/legal/privacy"
            className={clsx(
              'transition-colors hover:text-text-brand',
              'md:text-balance',
              landing
                ? 'md:text-base md:leading-[1.24] lg:text-right'
                : 'md:text-right md:text-sm md:leading-[1.24] lg:text-base',
            )}
          >
            {t('privacy')}
          </Link>
        </div>
      </div>
    </footer>
  );
}

/**
 * Подпись колонки. У футера приложения строка подписи держит высоту 42 с 768:
 * в макете она ровно такая же, как ряд плиток соцсетей в соседней колонке, —
 * иначе значения колонок не встают на одну линию.
 */
function Caption({
  landing,
  className,
  children,
}: {
  landing: boolean;
  className: string;
  children: React.ReactNode;
}) {
  if (landing) return <div className={className}>{children}</div>;
  return (
    <div className="md:flex md:h-[42px] md:items-center">
      <span className={className}>{children}</span>
    </div>
  );
}

/**
 * Плитка соцсети: 42×42 r16 у приложения на всех ширинах, у лендинга с 768
 * она вырастает до 72×72 r28.
 * Подскок при наведении — CSS-трансформом, а не framer-motion: футер
 * рендерится на каждой странице и остаётся серверным компонентом.
 */
function SocialLink({
  href,
  label,
  landing,
  children,
}: {
  href: string;
  label: string;
  landing: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={clsx(
        'inline-flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-footer-tile text-text-default transition-[background-color,transform] duration-200 hover:scale-110 hover:bg-comp-surface2-hover active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100',
        landing && 'md:h-[72px] md:w-[72px] md:rounded-[28px]',
      )}
    >
      {children}
    </a>
  );
}
