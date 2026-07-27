import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';

/**
 * Футер — 1:1 по мастер-компоненту Figma (footer, 847:49658): контакты
 * (соцсети + телефон) / график работы / документы, ниже копирайт.
 * На мобильных — одна колонка с выравниванием влево (как во фреймах 480/360).
 *
 * Ссылки на разделы сюда не добавляем — в макете их нет ни в шапке, ни в
 * футере (роль навигационного хаба играют карточки-действий, хлебные крошки
 * и сайдбар кабинета, см. Header.tsx). Переключатель языка — там же, в шапке.
 */
export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="mt-10 border-t border-stroke-surface3 bg-surface-page-surf2 sm:mt-16">
      {/* На мобильных у футера собственный отступ 24 (мастер 1957:243918),
          шире общей колонки, — отсюда max-md:px-6. */}
      <div className="container-page py-6 max-md:px-6 md:pb-20 md:pt-[60px] xl:pb-[100px] xl:pt-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-10">
          <div>
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
              {/* Telegram скрыт: t.me/ecash — чужой крипто-проект (eCash/XEC,
                  19k подписчиков), не наша компания. Вернуть, когда у бизнеса
                  появится собственный handle. */}
            </div>
            <a
              href="tel:+77059089073"
              className="mt-2 block text-base text-text-default transition-colors hover:text-text-brand md:text-xl md:font-bold"
            >
              +7 (705) 908 90 73
            </a>
          </div>

          <div className="md:text-center">
            <div className="text-sm text-text-disabled md:flex md:h-[42px] md:items-center md:justify-center md:text-base md:font-medium">
              {t('schedule')}
            </div>
            <div className="mt-2 text-base text-text-default md:text-xl md:font-bold">
              {t('scheduleValue')}
            </div>
          </div>

          <div className="md:text-right">
            <div className="text-sm text-text-disabled md:flex md:h-[42px] md:items-center md:justify-end md:text-base md:font-medium">
              {t('additional')}
            </div>
            {/* Реального адреса документов пока нет: текст без маркеров ссылки,
                чтобы не выглядел кликабельным. */}
            <span className="mt-2 inline-flex items-center gap-2.5 text-base text-text-default md:text-xl md:font-bold">
              {t('documents')}
              <Icon name="arrow_outward" size={20} />
            </span>
          </div>
        </div>

        <div className="mt-12 text-sm text-text-disabled md:text-base">
          © {new Date().getFullYear()}. {t('rights')}
        </div>
      </div>
    </footer>
  );
}
