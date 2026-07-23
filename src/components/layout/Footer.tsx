import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';

/**
 * Футер: контакты + график работы + документы, ниже копирайт.
 * На мобильных — одна колонка с выравниванием влево (как во фреймах 480/360).
 */
export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="mt-10 border-t border-stroke-surface3 bg-surface-page-surf2 sm:mt-16">
      <div className="container-page py-10 sm:pb-[100px] sm:pt-20">
        <div className="grid grid-cols-1 gap-8 sm:gap-10 md:grid-cols-3">
          <div>
            <div className="flex gap-2">
              <a
                href="https://wa.me/77059089073"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-btn-2 text-text-default transition-colors hover:bg-comp-surface2-hover sm:h-10 sm:w-10"
              >
                {/* WhatsApp */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.1 4c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.4 3.9 2.2.9 2.6.7 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.2-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.5-.6c.1-.2.1-.3.2-.5v-.4L10.3 8c-.1-.3-.3-.3-.5-.3h-.4l-.5.1Z" />
                </svg>
              </a>
              <a
                href="https://t.me/ecash"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-btn-2 text-text-default transition-colors hover:bg-comp-surface2-hover sm:h-10 sm:w-10"
              >
                <Icon name="send" size={18} filled />
              </a>
            </div>
            <a
              href="tel:+77059089073"
              className="mt-4 block text-lg font-bold text-text-default transition-colors hover:text-text-brand sm:text-xl"
            >
              +7 (705) 908 90 73
            </a>
          </div>

          <div className="md:text-center">
            <div className="text-sm text-text-disabled sm:text-base">{t('schedule')}</div>
            <div className="mt-2 text-lg font-bold text-text-default sm:mt-3 sm:text-xl">
              {t('scheduleValue')}
            </div>
          </div>

          <div className="md:text-right">
            <div className="text-sm text-text-disabled sm:text-base">{t('additional')}</div>
            <a
              href="#"
              className="mt-2 inline-flex items-center gap-1 text-lg font-bold text-text-default transition-colors hover:text-text-brand sm:mt-3 sm:text-xl"
            >
              {t('documents')}
              <Icon name="arrow_outward" size={20} />
            </a>
          </div>
        </div>

        <div className="mt-10 text-xs text-text-disabled sm:mt-12 sm:text-base">
          © {new Date().getFullYear()}. {t('rights')}
        </div>
      </div>
    </footer>
  );
}
