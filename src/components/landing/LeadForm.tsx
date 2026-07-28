'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { useMutation } from '@/lib/useApi';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';

/**
 * Блок действия секции «Свяжитесь с нашим специалистом…».
 *
 * В макете здесь ровно одна кнопка «a-button-main» 254×80, r102, p24/40,
 * gap24, #F15A25 с текстом Roboto Regular 24/32 #EEEEEE и стрелкой 32
 * (2153:195511 · 1024 2153:195816 · 768 2153:196005 · 480 2153:196193 ·
 * 360 2153:196392) — на всех брейкпоинтах одинаковая, мобильного варианта
 * 66/r40 у неё нет.
 *
 * Поля заявки макет не рисует, поэтому в первом кадре их нет: форма
 * раскрывается по нажатию кнопки, чтобы вёрстка совпадала с макетом и при
 * этом не терялась отправка заявки в /api/franchise-leads.
 */
export function LeadForm({ cta }: { cta: string }) {
  const t = useTranslations('franchise');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [done, setDone] = useState(false);
  const errorText = useErrorText();

  const send = useMutation(api.franchiseLead);

  if (done) {
    return (
      <div className="mt-20 flex items-center justify-center gap-3 text-base text-text-positive md:justify-start">
        <Icon name="check_circle" size={22} filled />
        {t('done')}
      </div>
    );
  }

  const submit = async () => {
    const res = await send.run({ name, phone, city });
    if (res) setDone(true);
  };

  const inputCls = (key?: string) =>
    clsx(
      'h-14 w-full rounded-2xl border bg-surface-page-bg/40 px-5 text-base text-text-default outline-none backdrop-blur-sm transition-colors placeholder:text-text-disabled focus:border-stroke-brand',
      key && send.field === key ? 'border-negative' : 'border-white/15',
    );

  return (
    <div className="mt-20 w-full text-left">
      <button
        type="button"
        onClick={() => (open ? void submit() : setOpen(true))}
        disabled={send.busy}
        aria-expanded={open}
        className="group relative mx-auto flex h-20 w-[254px] cursor-pointer items-center justify-center gap-6 overflow-hidden rounded-[102px] bg-brand px-10 text-2xl leading-8 text-text-default shadow-[0_12px_40px_rgb(241_90_37/0.45)] transition-[box-shadow,filter] hover:shadow-[0_20px_64px_rgb(241_90_37/0.65)] hover:brightness-110 disabled:opacity-60 md:mx-0"
      >
        {/* блик, пробегающий по кнопке при наведении */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-full w-1/2 skew-x-[-20deg] bg-white/25 blur-md transition-[left] duration-700 ease-out group-hover:left-[150%]"
        />
        {cta}
        <Icon
          name="arrow_forward"
          size={32}
          className="transition-transform duration-300 group-hover:translate-x-1"
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap lg:max-w-2xl">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('name')}
                className={clsx(inputCls('name'), 'sm:min-w-[200px] sm:flex-1')}
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('phone')}
                inputMode="tel"
                className={clsx(inputCls('phone'), 'sm:min-w-[200px] sm:flex-1')}
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('city')}
                className={clsx(inputCls(), 'sm:min-w-[200px] sm:flex-1')}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {send.error && <p className="mt-3 text-sm text-text-negative">{errorText(send.error)}</p>}
    </div>
  );
}
