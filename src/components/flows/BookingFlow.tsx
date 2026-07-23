'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Toast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useMutation } from '@/lib/useApi';
import { useErrorText } from '@/lib/useErrorText';
import type { Booking } from '@/lib/types';
import { AmountBox, BranchAddress, BanknotesPicker } from './PairFields';

const RATE = 538.45;
const rateLabel = `${String(RATE).replace('.', ',')} ₸ = 1 $`;

type Mode = 'booking' | 'individual';

/** Флоу «Забронировать курс» и «Запросить индивидуальный курс». */
export function BookingFlow({ mode }: { mode: Mode }) {
  const t = useTranslations('flows');
  const errorText = useErrorText();

  const [give, setGive] = useState('500 000');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [banknotes, setBanknotes] = useState<string | null>(null);
  const [individual, setIndividual] = useState(mode === 'individual');
  const [showErrors, setShowErrors] = useState(false);
  const [created, setCreated] = useState<Booking | null>(null);

  const create = useMutation(api.bookings.create);

  const amount = useMemo(
    () => parseFloat(give.replace(/\s/g, '').replace(',', '.')),
    [give],
  );

  const get = useMemo(() => {
    if (mode === 'individual') return t('pair.underReview');
    return Number.isFinite(amount) ? `${(amount / RATE).toFixed(2).replace('.', ',')} $` : '';
  }, [amount, mode, t]);

  const phoneInvalid = showErrors && phone.trim().length < 10;

  const submit = async () => {
    if (phone.trim().length < 10 || !Number.isFinite(amount) || amount <= 0) {
      setShowErrors(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const res = await create.run({
      type: individual ? 'individual' : 'booking',
      from: 'KZT',
      to: 'USD',
      amount,
      banknotes: banknotes as 'small' | 'large' | null,
      branchId: 'br1',
      side: 'buy',
      phone: phone.trim(),
      name: name.trim(),
    });
    if (!res) {
      setShowErrors(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCreated(res.booking);
    window.scrollTo({ top: 0 });
  };

  if (created) return <BookingDone booking={created} banknotes={banknotes} />;

  return (
    <div className="container-page flex flex-col gap-5 pt-6">
      <Toast
        open={showErrors}
        tone="negative"
        onClose={() => setShowErrors(false)}
        closeLabel={t('close')}
      >
        {create.error ? errorText(create.error) : t('fillRequired')}
      </Toast>

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text-default sm:text-[28px]">{t('pair.title')}</h1>
            {mode === 'individual' && (
              <p className="mt-1 max-w-md text-sm text-text-disabled">{t('pair.individualHint')}</p>
            )}
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-fit shrink-0 cursor-pointer items-center gap-2 rounded-2xl border border-stroke-surface2 px-3 text-sm text-text-default transition-colors hover:bg-comp-surface1-hover sm:h-11 sm:px-4"
          >
            <Icon name="visibility_off" size={20} />
            {t('pair.dynamics')}
            <Icon name="keyboard_arrow_down" size={20} />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <AmountBox
            label={`${t('pair.give')} (₸)`}
            value={give}
            onChange={setGive}
            currency={{ flag: 'kz', code: 'KZT' }}
          />
          <span className="mx-auto text-text-disabled">
            <Icon name={mode === 'individual' ? 'arrow_forward' : 'sync_alt'} size={22} />
          </span>
          <AmountBox
            label={`${t('pair.get')} ($)`}
            value={get}
            readOnly
            currency={{ flag: 'us', code: 'USD' }}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-text-default">
          {t('pair.currentRate')}
          <span className="rounded-full bg-brand-hardsoft px-3 py-1.5 font-medium text-text-brand">
            {rateLabel}
          </span>
        </div>

        <div className="mt-8">
          <BranchAddress />
        </div>
      </section>

      <BanknotesPicker value={banknotes} onChange={setBanknotes} />

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('data.title')}</h2>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('data.phone')}
            inputMode="tel"
            className={clsx(
              'h-12 flex-1 rounded-2xl border bg-transparent px-4 text-base text-text-default outline-none placeholder:text-text-disabled',
              phoneInvalid ? 'border-negative' : 'border-stroke-modal focus:border-stroke-surface3',
            )}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('data.name')}
            className="h-12 flex-1 rounded-2xl border border-stroke-modal bg-transparent px-4 text-base text-text-default outline-none placeholder:text-text-disabled focus:border-stroke-surface3"
          />
        </div>

        {mode === 'booking' && (
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-text-disabled">
            <input
              type="checkbox"
              checked={individual}
              onChange={(e) => setIndividual(e.target.checked)}
              className="sr-only"
            />
            <span
              className={clsx(
                'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                individual
                  ? 'border-transparent bg-brand text-text-always-white'
                  : 'border-stroke-surface3 text-transparent',
              )}
            >
              <Icon name="check" size={14} />
            </span>
            {t('data.requestIndividual')}
          </label>
        )}

        <Button
          className="mt-6 w-full sm:w-auto sm:min-w-52"
          onClick={submit}
          disabled={create.busy}
        >
          {individual ? t('data.requestIndividualCta') : t('data.book')}
        </Button>
      </section>
    </div>
  );
}

/** Статус после отправки: щит, бейджи, живой таймер и read-only заявка. */
function BookingDone({ booking, banknotes }: { booking: Booking; banknotes: string | null }) {
  const t = useTranslations('flows');
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!booking.expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.floor((booking.expiresAt! - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [booking.expiresAt]);

  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');
  const isBooking = booking.type === 'booking';
  const sentAt = new Date(booking.createdAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="container-page flex flex-col gap-5 pt-10">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-hardsoft">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-text-always-white">
            <Icon name="verified_user" size={26} filled />
          </span>
        </span>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {isBooking && (
            <span className="rounded-md bg-alert px-2 py-0.5 text-[11px] font-medium text-text-inverted">
              {t('done.booking30')}
            </span>
          )}
          <span className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-medium text-text-always-white">
            {t('done.yourNumberValue', { value: booking.maskedNumber })}
          </span>
        </div>
        <h1 className="mt-3 text-lg font-bold text-text-default sm:text-2xl">
          {isBooking ? t('done.titleBooking') : t('done.titleIndividual')}
        </h1>
        {booking.expiresAt && (
          <div className="mt-3 flex items-center gap-1 text-lg text-text-default">
            <span className="rounded-lg bg-surface-page-surf2 px-3 py-1.5">
              {mm} {t('done.min')}
            </span>
            :
            <span className="rounded-lg bg-surface-page-surf2 px-3 py-1.5">
              {ss} {t('done.sec')}
            </span>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('done.yourRequest')}</h2>
        <p className="mt-1 text-sm text-text-disabled">
          {t('done.sentAt')}: {sentAt}
        </p>
      </div>

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <h3 className="text-lg font-bold text-text-default sm:text-xl">{t('pair.title')}</h3>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
          <AmountBox
            label={`${t('pair.give')} (₸)`}
            value={booking.amount.toLocaleString('ru-RU')}
            readOnly
            currency={{ flag: 'kz', code: 'KZT' }}
          />
          <AmountBox
            label={`${t('pair.get')} ($)`}
            value={booking.result === null ? t('pair.underReview') : `${booking.result} $`}
            readOnly
            currency={{ flag: 'us', code: 'USD' }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-disabled">
          {t('done.rateAtSubmit')}:
          <span className="rounded-full bg-surface-page-surf2 px-3 py-1.5">{rateLabel}</span>
        </div>

        <div className="mt-8 flex items-start justify-between gap-4">
          <BranchAddress withBetterRate={false} />
          <button
            type="button"
            className="flex shrink-0 cursor-pointer flex-col items-center gap-1 text-xs text-text-default"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-text-always-white">
              <Icon name="map" size={22} filled />
            </span>
            {t('done.onMap')}
          </button>
        </div>
      </section>

      {banknotes && (
        <section className="rounded-2xl bg-surface-page-surf1 px-5 py-4 sm:rounded-3xl sm:px-8 sm:py-5">
          <div className="text-sm text-text-disabled">{t('banknotes.label')}</div>
          <div className="mt-2 flex items-center gap-3 text-base text-text-default">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-modal-surf1">
              <Icon name="check" size={14} />
            </span>
            {t(`banknotes.${banknotes}`)}
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <h3 className="text-lg font-bold text-text-default sm:text-xl">{t('done.yourData')}</h3>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex h-12 flex-1 items-center rounded-2xl border border-stroke-modal px-4 text-text-default">
            {booking.phone}
          </div>
          <div className="flex h-12 flex-1 items-center rounded-2xl border border-stroke-modal px-4 text-text-default">
            {booking.name || '—'}
          </div>
        </div>
      </section>
    </div>
  );
}
