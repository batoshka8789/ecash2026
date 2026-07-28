import { useTranslations } from 'next-intl';

/**
 * Футер — 1:1 по мастер-компоненту Figma (footer, 847:49658): контакты
 * (соцсети + телефон) / график работы / документы, ниже копирайт.
 *
 * Ряд колонок — flex со space-between, а не равные трети: в макете
 * (Frame 1437255431, 1849:146835) колонки имеют собственную ширину
 * 179 / 207 / 144 и стоят на 0 / 514 / 1056 внутри 1200, подписи внутри
 * каждой прижаты влево. На мобильных — одна колонка (480/360).
 *
 * Боковые поля по макету, как и у шапки: 360 на 1920 (контент 1200), 52 на
 * 1024 и 768, 24 на 480 и 360. Вертикальные — 80/100 на 1920, 60/80 на
 * 1024–768, 24 на мобильных.
 *
 * Отступ от контента до футера в макете 140 (≥768) и 146 (≤480). У <main>
 * на всех страницах есть pb-4, поэтому здесь margin на 16 меньше.
 *
 * Обводка: в макете stroke 1px #6B6B6B по всему контуру со strokeAlign=INSIDE.
 * Верхняя нарисована border-ом (в макете она так же сдвигает контент на 1px
 * вниз: ряд колонок стоит на padding+1), остальные три — внутренней тенью,
 * иначе border-left/right сместил бы колонку на 1px и логотипы шапки и
 * футера разъехались бы.
 *
 * Ссылки на разделы сюда не добавляем — в макете их нет ни в шапке, ни в
 * футере (роль навигационного хаба играют карточки-действий, хлебные крошки
 * и сайдбар кабинета, см. Header.tsx). Переключателя языка в футере тоже нет:
 * у инстанса footer ровно двое детей — ряд колонок и строка копирайта, справа
 * от копирайта пусто до правого края контента.
 */
export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="mt-[130px] border-t border-stroke-surface3 bg-surface-page-surf2 shadow-[inset_1px_0_0_0_var(--stroke-surface3),inset_-1px_0_0_0_var(--stroke-surface3),inset_0_-1px_0_0_var(--stroke-surface3)] md:mt-[124px]">
      <div className="mx-auto w-full max-w-[1304px] px-6 py-6 md:px-[52px] md:pb-20 md:pt-[60px] xl:pb-[100px] xl:pt-20">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between md:gap-10">
          <div>
            {/* ряд соцсетей 92×42: две кнопки 42×42 с зазором 8 (847:49635) */}
            <div className="flex gap-2">
              <a
                href="https://wa.me/77059089073"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface1-hover"
              >
                {/* WhatsApp */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.1 4c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.4 3.9 2.2.9 2.6.7 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.2-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.5-.6c.1-.2.1-.3.2-.5v-.4L10.3 8c-.1-.3-.3-.3-.5-.3h-.4l-.5.1Z" />
                </svg>
              </a>
              {/* Telegram. Публичного канала у компании нет (t.me/ecash — чужой
                  крипто-проект), поэтому ведём в личный чат по рабочему
                  номеру: t.me/+<номер> открывает переписку без юзернейма. */}
              <a
                href="https://t.me/+77059089073"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface1-hover"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M21.6 4.2a1 1 0 0 0-1-.2L2.9 10.5c-.8.3-.8 1.4 0 1.7l4.3 1.5 1.7 5.1c.2.7 1.1.9 1.6.4l2.4-2.3 4.2 3.1c.6.4 1.4.1 1.6-.6l3.2-14a1 1 0 0 0-.3-1.2ZM9.4 13.4l-.5 3.4-1.2-3.7 9-5.5-7.3 5.8Z" />
                </svg>
              </a>
            </div>
            {/* значение: 16/20 Regular на мобильных, 20/28 Bold от 768 */}
            <a
              href="tel:+77059089073"
              className="mt-2 block text-base leading-5 text-text-default transition-colors hover:text-text-brand md:text-xl md:font-bold md:leading-7"
            >
              +7 (705) 908 90 73
            </a>
          </div>

          <div>
            {/* подпись: 14/15 Regular на мобильных, 16/19.2 Medium в блоке 42 от 768 */}
            <div className="text-sm leading-[15px] text-text-disabled md:flex md:h-[42px] md:items-center md:text-base md:font-medium md:leading-[19.2px]">
              {t('schedule')}
            </div>
            <div className="mt-2 text-base leading-5 text-text-default md:text-xl md:font-bold md:leading-7">
              {t('scheduleValue')}
            </div>
          </div>

          <div>
            <div className="text-sm leading-[15px] text-text-disabled md:flex md:h-[42px] md:items-center md:text-base md:font-medium md:leading-[19.2px]">
              {t('additional')}
            </div>
            {/* Реального адреса документов пока нет: текст без маркеров ссылки,
                чтобы не выглядел кликабельным. */}
            <span className="mt-2 flex items-center gap-2.5 text-base leading-5 text-text-default md:text-xl md:font-bold md:leading-7">
              {t('documents')}
              {/* lucide/arrow-up-right (847:49648): бокс 20×20, вектор 8.33×8.33
                  по центру, обводка 1.667 — это stroke-width 2 в сетке 24 при
                  масштабе 20/24. Material Symbols тут не подходит: у глифа
                  другая пропорция и толщина штриха. */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </span>
          </div>
        </div>

        <div className="mt-12 text-sm leading-[15px] text-text-disabled md:text-base md:leading-5">
          © {new Date().getFullYear()}. {t('rights')}
        </div>
      </div>
    </footer>
  );
}
