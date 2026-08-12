'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import {
  consentServerSnapshot,
  readConsent,
  subscribeConsent,
  writeConsent,
} from '@/lib/legal/consent-storage';

/**
 * Принятие согласия прямо в конце документа — чтобы не возвращаться на
 * форму и не искать там галочку.
 *
 * Пункт 7 самого Согласия называет нажатие «предусмотренным интерфейсом
 * действием по подтверждению»: клик по этой кнопке и есть согласие,
 * и он даже весомее галочки — человек дочитал до конца текста.
 *
 * Вкладка с формой узнаёт о нажатии через событие `storage` (см.
 * consent-storage.ts) и проставляет галочку сама. Закрыть эту вкладку
 * скриптом нельзя — её открыл человек по ссылке с `rel="noopener"`,
 * поэтому после принятия просто говорим, что можно вернуться.
 */
export function ConsentAccept() {
  const t = useTranslations('legal');
  // На сервере согласия нет всегда — поэтому разметка сходится при
  // гидратации, а после неё React перечитает настоящее значение сам.
  const accepted = useSyncExternalStore(subscribeConsent, readConsent, consentServerSnapshot);

  if (accepted) {
    return (
      <div className="mt-10 rounded-2xl bg-brand-hardsoft p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-text-default sm:text-base">
          <Icon name="check_circle" size={22} className="shrink-0 text-text-brand" />
          {t('accepted')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-disabled">{t('acceptedHint')}</p>
        <Link
          href="/signup"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-text-brand transition-opacity hover:opacity-80"
        >
          {t('toSignup')}
          <Icon name="arrow_forward" size={20} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-2xl bg-surface-page-surf2 p-5 sm:p-6">
      <p className="text-sm leading-relaxed text-text-disabled">{t('acceptNote')}</p>
      <Button
        type="button"
        size="lg"
        className="mt-4 w-full sm:w-auto"
        onClick={writeConsent}
      >
        {t('accept')}
      </Button>
    </div>
  );
}
