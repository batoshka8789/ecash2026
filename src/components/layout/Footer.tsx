import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';

/**
 * Футер сайта: контакты (соцсети + телефон) / график работы / документы,
 * ниже копирайт. Раскладка из макета лендинга — до 768 колонка у левого
 * края, с 768 центрированная колонка, с 1024 ряд.
 *
 * Один и тот же футер на всех страницах, включая /franchise. Линия сверху
 * и плитки соцсетей заданы токенами footer-divider / footer-tile: в макете
 * там литеральные #303030 и #272626, но светлой темы у лендинга в макете
 * нет, а на белом футере обе эти краски пропадают. Токены обязательны и
 * по другой причине: лендинг форсирует тёмную тему классом .theme-dark на
 * своём контейнере, поэтому переопределение через :root[data-theme='light']
 * сработало бы и на нём — токены же переобъявлены внутри .theme-dark.
 *
 * Ссылки на разделы сюда не добавляем — в макете их нет ни в шапке, ни в
 * футере (роль навигационного хаба играют карточки-действий, хлебные крошки
 * и сайдбар кабинета, см. Header.tsx). Переключатель языка — там же, в шапке.
 */
export function Footer({ className }: { className?: string }) {
  const t = useTranslations('footer');

  return (
    <footer
      className={clsx(
        'relative border-t border-footer-divider bg-surface-modal-bg',
        // отбивка сверху: у страниц приложения своя, лендинг передаёт ритм макета
        className ?? 'mt-10 sm:mt-16',
      )}
    >
      {/*
        Своя обёртка, а не Container: у футера колонка макета шире страничной
        (1448/124 против 1324/0) и свои паддинги по брейкпоинтам.
      */}
      <div className="relative mx-auto w-full max-w-[1448px] px-6 py-6 md:px-5 md:py-[60px] lg:px-10 xl:px-[124px] xl:pt-[100px]">
        {/* 768: одна центрированная колонка, gap 60; с 1024 — ряд */}
        <div className="flex flex-col gap-6 md:items-center md:gap-[60px] lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-2 md:items-center md:gap-6 lg:items-start">
            <div className="flex gap-2 md:gap-4">
              <SocialLink href="https://wa.me/77059089073" label="WhatsApp">
                {/* знак из набора макета (whatsApp.svg): кольцо обводкой,
                    трубка заливкой — поэтому fill/stroke заданы у путей,
                    а не у корня */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className="h-5 w-5 md:h-8 md:w-8"
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
              <SocialLink href="https://t.me/ecash" label="Telegram">
                {/* знак из набора макета (telegram.svg) */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className="h-5 w-5 md:h-8 md:w-8"
                >
                  <path
                    d="M19.0416 21.8879C19.3137 21.912 19.5851 21.8328 19.8009 21.6662C20.0168 21.4997 20.1612 21.2581 20.2051 20.9901L23.9968 2.96542C24.0076 2.84925 23.9911 2.73216 23.9483 2.6235C23.9055 2.51485 23.8377 2.41765 23.7504 2.33966C23.5984 2.19639 23.3985 2.11402 23.1892 2.1084C23.1161 2.1084 15.5739 4.87897 0.562132 10.4201C0.392723 10.4738 0.245888 10.5816 0.144412 10.7267C0.0429359 10.8719 -0.00750904 11.0462 0.000904983 11.2227C0.0104581 11.3876 0.0726994 11.545 0.178567 11.6723C0.284433 11.7995 0.428401 11.8898 0.589509 11.9301L6.06489 13.617L8.26873 20.1875C8.32632 20.3665 8.44245 20.5213 8.59869 20.6273C8.75493 20.7333 8.94232 20.7843 9.1311 20.7724C9.23328 20.7721 9.33434 20.7514 9.42837 20.7117C9.5224 20.6721 9.60749 20.614 9.67864 20.5411L12.7859 17.6028L18.3845 21.6839C18.5796 21.8125 18.8075 21.8833 19.0416 21.8879ZM9.03529 18.5687L7.37898 13.1272C15.3365 8.09393 19.3427 5.57729 19.3975 5.57729C19.6028 5.57729 19.7123 5.57729 19.7123 5.79495C19.7169 5.82196 19.7169 5.84955 19.7123 5.87657C19.7123 5.87657 16.2765 9.00537 9.41856 15.127L9.03529 18.5687Z"
                    fill="currentColor"
                  />
                </svg>
              </SocialLink>
            </div>
            <a
              href="tel:+77059089073"
              className="text-base leading-5 text-text-default transition-colors hover:text-text-brand md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]"
            >
              +7 (705) 908 90 73
            </a>
          </div>

          <div className="flex flex-col gap-2 md:items-center md:gap-6 lg:items-start lg:gap-10">
            <div className="text-sm leading-[1.1] text-text-disabled md:text-xl md:leading-8 md:text-text-default">
              {t('schedule')}
            </div>
            <div className="text-base leading-5 text-text-default md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]">
              {t('scheduleValue')}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:items-center md:gap-6 lg:items-start lg:gap-10">
            <div className="text-sm leading-[1.1] text-text-disabled md:text-xl md:leading-8 md:text-text-default">
              {t('additional')}
            </div>
            {/* Реального адреса документов пока нет: текст без маркеров ссылки,
                чтобы не выглядел кликабельным. */}
            <span className="inline-flex items-center gap-2.5 text-base leading-5 text-text-default md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]">
              {t('documents')}
              <Icon name="arrow_outward" size={20} />
            </span>
          </div>
        </div>

        {/* 480: копирайт у левого края, 768 — по центру */}
        <div className="mt-12 text-left text-sm leading-[1.1] text-text-disabled md:mt-20 md:text-center md:text-xl md:leading-8 md:text-text-default lg:text-left">
          © {new Date().getFullYear()}. {t('rights')}
        </div>
      </div>
    </footer>
  );
}

/**
 * Плитка соцсети: 42×42 r16 #262626 до 768, 72×72 r28 #272626 с 768.
 * Подскок при наведении — CSS-трансформом, а не framer-motion: футер
 * рендерится на каждой странице и остаётся серверным компонентом.
 */
function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-footer-tile text-text-default transition-[background-color,transform] duration-200 hover:scale-110 hover:bg-comp-surface2-hover active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 md:h-[72px] md:w-[72px] md:rounded-[28px]"
    >
      {children}
    </a>
  );
}
