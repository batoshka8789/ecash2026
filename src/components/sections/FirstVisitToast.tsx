'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Toast } from '@/components/ui/Toast';
import { AddressModal } from './AddressModal';

/**
 * Тост первого визита «Выберите адрес — найдём ближайшие обменники».
 * Ссылка открывает модалку выбора адреса (экран «modal window adress» макета).
 */
export function FirstVisitToast() {
  const t = useTranslations('home.toast');
  const [open, setOpen] = useState(true);
  const [modal, setModal] = useState(false);

  return (
    <>
      <div className="pt-6 sm:pt-8">
        <Toast open={open} onClose={() => setOpen(false)} closeLabel={t('close')} fixed={false}>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="cursor-pointer font-medium text-text-brand underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            {t('link')}
          </button>
          {', '}
          {t('rest')}
        </Toast>
      </div>

      <AddressModal open={modal} onClose={() => setModal(false)} />
    </>
  );
}
