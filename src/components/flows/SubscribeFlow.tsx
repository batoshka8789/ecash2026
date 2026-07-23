'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { api } from '@/lib/api';
import { useMutation } from '@/lib/useApi';

const RATE = 538.45;
const EXCHANGE_RATE = `${String(RATE).replace('.', ',')} ₸ = 1 $`;

/** Селект-заглушка в стиле макета (Число / Месяц / Год). */
function SelectBox({
  placeholder,
  value,
  options,
  onChange,
  invalid,
}: {
  placeholder: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex h-12 min-w-28 cursor-pointer items-center justify-between gap-2 rounded-2xl border px-4 text-base transition-colors',
          invalid ? 'border-negative' : 'border-stroke-modal hover:border-stroke-surface3',
          value ? 'text-text-default' : 'text-text-disabled',
        )}
      >
        {value || placeholder}
        <Icon name="keyboard_arrow_down" size={18} className="text-text-disabled" />
      </button>
      {open && (
        <div className="absolute left-0 top-14 z-40 max-h-64 min-w-full overflow-auto rounded-2xl bg-surface-modal-bg py-2 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-6 px-4 py-2 text-left text-base text-text-default transition-colors hover:bg-surface-modal-surf1-hover"
            >
              {opt}
              <span
                className={clsx(
                  'h-3.5 w-3.5 rounded-full',
                  opt === value ? 'bg-brand' : 'bg-surface-modal-surf1',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Флоу «Уведомить об изменении курса». */
export function SubscribeFlow() {
  const t = useTranslations('subscribe');
  const [rate, setRate] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [done, setDone] = useState(false);
  const create = useMutation(api.subscriptions.create);

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const months = Array.from({ length: 12 }, (_, i) => t(`months.${i}`));
  const years = ['2025', '2026', '2027', '2028', '2029', '2030'];

  const submit = async () => {
    if (!rate || !day || !month || !year) {
      setShowErrors(true);
      return;
    }
    const res = await create.run({
      from: 'KZT',
      to: 'USD',
      targetRate: parseFloat(rate.replace(',', '.')),
      day,
      month,
      year,
    });
    if (res) setDone(true);
    else setShowErrors(true);
  };

  return (
    <div className="container-page flex flex-col gap-5 pt-6">
      {showErrors && !done && (
        <div className="fixed left-1/2 top-24 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-toast py-3 pl-4 pr-2 shadow-md">
          <Icon name="warning" size={20} className="text-negative" filled />
          <p className="max-w-52 text-sm leading-tight text-text-default">{t('fillRequired')}</p>
          <button
            type="button"
            onClick={() => setShowErrors(false)}
            aria-label={t('close')}
            className="ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-text-default hover:bg-comp-surface2-hover"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {done && (
        <div className="fixed left-1/2 top-24 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-toast py-3 pl-4 pr-2 shadow-md">
          <Icon name="check_circle" size={20} className="text-positive" filled />
          <p className="text-sm leading-tight text-text-default">{t('doneToast')}</p>
          <button
            type="button"
            onClick={() => setDone(false)}
            aria-label={t('close')}
            className="ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-text-default hover:bg-comp-surface2-hover"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h1 className="text-xl font-bold sm:text-[28px] text-text-default">{t('pairTitle')}</h1>
          <button
            type="button"
            className="inline-flex h-10 w-fit shrink-0 cursor-pointer items-center gap-2 rounded-2xl border border-stroke-surface2 px-3 text-sm text-text-default transition-colors hover:bg-comp-surface1-hover sm:h-11 sm:px-4"
          >
            <Icon name="visibility_off" size={20} />
            {t('dynamics')}
            <Icon name="keyboard_arrow_down" size={20} />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          <div
            className={clsx(
              'flex flex-1 items-center overflow-hidden rounded-2xl bg-surface-page-surf2',
              showErrors && !rate && 'border border-negative',
            )}
          >
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={t('desiredRate')}
              inputMode="decimal"
              className="h-14 w-full bg-transparent px-4 text-base text-text-default outline-none placeholder:text-text-disabled"
            />
            <button
              type="button"
              className="m-2 inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-surface-modal-surf1 px-3 py-2 text-base font-medium text-text-default transition-colors hover:bg-comp-surface2-hover"
            >
              <CurrencyFlag flag="kz" className="h-6 w-9" />
              KZT
              <Icon name="keyboard_arrow_down" size={18} />
            </button>
          </div>

          <span className="mx-auto text-text-disabled">
            <Icon name="arrow_forward" size={22} />
          </span>

          <div className="flex items-center gap-3 rounded-2xl bg-surface-page-surf2 py-2 pl-4 pr-2">
            <div>
              <div className="text-[11px] leading-tight text-text-disabled">{t('rateLabel')}</div>
              <div className="text-base text-text-default">1 ($)</div>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-surface-modal-surf1 px-3 py-2 text-base font-medium text-text-default transition-colors hover:bg-comp-surface2-hover"
            >
              <CurrencyFlag flag="us" className="h-6 w-9" />
              USD
              <Icon name="keyboard_arrow_down" size={18} />
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 text-sm text-text-default">
          {t('currentRate')}:
          <span className="rounded-full bg-brand-hardsoft px-3 py-1.5 font-medium text-text-brand">
            {EXCHANGE_RATE}
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('dateTitle')}</h2>
        <div className="mt-5">
          <div className="text-sm text-text-disabled">{t('notifyUntil')}:</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SelectBox placeholder={t('day')} value={day} options={days} onChange={setDay} invalid={showErrors && !day} />
            <SelectBox placeholder={t('month')} value={month} options={months} onChange={setMonth} invalid={showErrors && !month} />
            <SelectBox placeholder={t('year')} value={year} options={years} onChange={setYear} invalid={showErrors && !year} />
            <div className="flex h-12 items-center gap-1 rounded-2xl bg-surface-page-surf2 px-4 text-base text-text-disabled">
              00 : 00
            </div>
          </div>
        </div>

        <Button className="mt-6 w-full sm:w-auto sm:min-w-52" onClick={submit} disabled={create.busy}>
          {t('cta')}
        </Button>
      </section>
    </div>
  );
}
