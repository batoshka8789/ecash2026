'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { useMutation } from '@/lib/useApi';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';

/**
 * Форма заявки на франшизу — уходит в мок-бэкенд (/api/franchise-leads).
 *
 * На мобильном поля и кнопка растянуты на всю ширину и выровнены по левому
 * краю внутри общего блока: раньше поля были левыми внутри центрированной
 * колонки, а кнопка — узкой по центру, из-за чего секция «разъезжалась».
 */
export function LeadForm({ cta }: { cta: string }) {
  const t = useTranslations('franchise');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [done, setDone] = useState(false);
  const errorText = useErrorText();

  const send = useMutation(api.franchiseLead);

  if (done) {
    return (
      <div className="mt-10 flex items-center justify-center gap-3 text-base text-text-positive md:mt-20 md:justify-start">
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
    <div className="mt-10 w-full text-left md:mt-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:max-w-2xl">
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

      <button
        type="button"
        onClick={submit}
        disabled={send.busy}
        className="group mt-4 inline-flex h-[66px] w-full cursor-pointer items-center justify-center gap-4 rounded-[40px] bg-brand px-6 text-base font-medium text-text-always-white shadow-[0_12px_40px_rgb(241_90_37/0.4)] transition-[filter,box-shadow,transform] hover:shadow-[0_18px_56px_rgb(241_90_37/0.6)] hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:w-auto md:h-20 md:gap-6 md:rounded-[102px] md:px-10 md:text-2xl"
      >
        {cta}
        <Icon
          name="arrow_forward"
          size={24}
          className="transition-transform duration-300 group-hover:translate-x-1"
        />
      </button>

      {send.error && (
        <p className="mt-3 text-sm text-text-negative">{errorText(send.error)}</p>
      )}
    </div>
  );
}
