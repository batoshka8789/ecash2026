'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';
import { useMutation } from '@/lib/useApi';
import { api } from '@/lib/api';

/**
 * Модалка «Укажите свой адрес» — экран «My location main / modal window adress»
 * (1345:77495, карточка 1355:94703).
 *
 * Спека: подложка #000000 60 %, карточка 952×818, p40, gap36, r20,
 * fill #262626, border 1px #333333; заголовок 32/500 lh38.4 по центру,
 * подпись 16/400; строка «поле 741×54 + кнопка 121×54»; карта 869×548 r20;
 * крестик 44×44 r40 вне карточки справа сверху.
 */
export function AddressModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('addressModal');
  const { user, setUser } = useAuth();
  const save = useMutation(api.profile.save);
  const [address, setAddress] = useState('');

  // Подставляем адрес при открытии. Правка состояния во время рендера —
  // штатный способ синхронизации с пропсами, без эффекта.
  const [syncedFor, setSyncedFor] = useState<boolean | null>(null);
  if (open && syncedFor !== open) {
    setSyncedFor(open);
    setAddress(user?.address || 'пр. Достык, 240');
  }
  if (!open && syncedFor) setSyncedFor(false);

  // закрытие по Esc и блокировка прокрутки под модалкой
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const submit = async () => {
    if (user) {
      const res = await save.run({ address });
      if (res) setUser(res.user);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-scrim p-4 py-10"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-[952px]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="absolute -top-14 right-0 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface2-hover lg:-right-14 lg:top-0"
            >
              <Icon name="close" size={20} />
            </button>

            <div className="flex flex-col gap-6 rounded-[20px] border border-stroke-surface1 bg-surface-page-surf1 p-5 sm:p-10 lg:gap-9">
              <div className="flex flex-col gap-1 text-center">
                <h2 className="text-xl font-medium leading-tight text-text-default sm:text-[32px]">
                  {t('title')}
                </h2>
                <p className="text-sm text-text-default sm:text-base">{t('subtitle')}</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex h-[54px] flex-1 items-center gap-2 rounded-[20px] border border-stroke-surface3 px-4 transition-colors focus-within:border-stroke-brand">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('placeholder')}
                    className="w-full bg-transparent text-base font-medium text-text-default outline-none placeholder:text-text-disabled"
                  />
                  {address && (
                    <button
                      type="button"
                      onClick={() => setAddress('')}
                      aria-label={t('clear')}
                      className="cursor-pointer text-text-disabled transition-colors hover:text-text-default"
                    >
                      <Icon name="cancel" size={20} />
                    </button>
                  )}
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={save.busy}
                  className="inline-flex h-[54px] cursor-pointer items-center justify-center rounded-[20px] bg-btn-brand px-6 text-sm font-medium text-text-always-white transition-[filter] hover:brightness-110 disabled:opacity-60"
                >
                  {t('save')}
                </button>
              </div>

              <div className="overflow-hidden rounded-[20px]">
                <img
                  src="/img/map-modal-dark.png"
                  alt={t('mapAlt')}
                  className="h-[280px] w-full object-cover sm:h-[420px] lg:h-[548px] [:root[data-theme='light']_&]:hidden"
                />
                <img
                  src="/img/map-modal-light.png"
                  alt=""
                  aria-hidden
                  className="hidden h-[280px] w-full object-cover sm:h-[420px] lg:h-[548px] [:root[data-theme='light']_&]:block"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
