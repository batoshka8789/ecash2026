'use client';

import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';

/** Поле суммы с плавающим лейблом и селектом валюты — блок «Валютная пара». */
export function AmountBox({
  label,
  value,
  onChange,
  currency,
  readOnly,
  invalid,
  className,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  currency: { flag: string; code: string };
  readOnly?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-1 items-center overflow-hidden rounded-2xl bg-surface-page-surf2',
        invalid && 'border border-negative',
        className,
      )}
    >
      <label className="min-w-0 flex-1 px-4 py-2">
        <span className="block text-[11px] leading-tight text-text-disabled">{label}</span>
        <input
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          inputMode="decimal"
          placeholder=" "
          className="w-full bg-transparent text-base text-text-default outline-none placeholder:text-text-disabled"
        />
      </label>
      <button
        type="button"
        className="m-2 inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-surface-modal-surf1 px-3 py-2 text-base font-medium text-text-default transition-colors hover:bg-comp-surface2-hover"
      >
        <CurrencyFlag flag={currency.flag} className="h-6 w-9" />
        {currency.code}
        <Icon name="keyboard_arrow_down" size={18} />
      </button>
    </div>
  );
}

/** Адрес отделения с бейджем «Ближе всего» и плашкой «курс выгоднее». */
export function BranchAddress({ withBetterRate = true }: { withBetterRate?: boolean }) {
  const t = useTranslations('flows.address');

  return (
    <div>
      <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('title')}</h2>
      <div className="mt-3">
        <span className="rounded-md bg-additional-3 px-2 py-0.5 text-[11px] font-medium text-text-always-white">
          {t('nearest')}
        </span>
        <div className="mt-2 flex items-center gap-2 text-base text-text-default">
          <Icon name="account_balance" size={18} className="text-text-disabled" />
          пр. Достык, 240
          <span className="text-text-disabled">• 6.2 {t('km')}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-sm">
          <Icon name="schedule" size={16} className="text-text-disabled" />
          <span className="text-text-default">08:00 - 20:00</span>
          <span className="text-text-positive">• {t('open')}</span>
        </div>
      </div>

      {withBetterRate && (
        <button
          type="button"
          className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-page-surf2 px-4 py-3 text-left text-sm text-text-default transition-colors hover:bg-comp-surface2-hover"
        >
          <Icon name="directions_run" size={20} className="text-brand" />
          <span>
            {t('betterAt')}{' '}
            <span className="text-text-brand">Темирязева 59</span>,
            <br />
            {t('betterRate')} = <span className="text-text-positive">521,16 ₸</span>
          </span>
          <Icon name="chevron_right" size={20} className="ml-2 text-text-disabled" />
        </button>
      )}
    </div>
  );
}

/** Аккордеон «Выбрать тип купюр». */
export function BanknotesPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const t = useTranslations('flows.banknotes');

  return (
    <div className="rounded-2xl bg-surface-page-surf1 px-5 py-4 sm:rounded-3xl sm:px-8 sm:py-5">
      {value === null ? (
        <button
          type="button"
          onClick={() => onChange('small')}
          className="flex cursor-pointer items-center gap-3 text-base text-text-default transition-opacity hover:opacity-80"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-text-always-white">
            <Icon name="add" size={18} />
          </span>
          {t('choose')}
        </button>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex cursor-pointer items-center gap-3 text-sm text-text-disabled transition-colors hover:text-text-default"
          >
            <Icon name="cancel" size={20} />
            {t('label')}
          </button>
          <div className="mt-3 flex flex-col gap-2">
            {(['small', 'large'] as const).map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-3 text-base text-text-default">
                <input
                  type="radio"
                  name="banknotes"
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  className="peer sr-only"
                />
                <span
                  className={clsx(
                    'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                    value === opt
                      ? 'border-transparent bg-surface-modal-surf1 text-text-default'
                      : 'border-stroke-surface3 text-transparent',
                  )}
                >
                  <Icon name="check" size={14} />
                </span>
                {t(opt)}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
