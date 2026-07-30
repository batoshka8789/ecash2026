'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { Select, type SelectOption } from '@/components/ui/Select';
import { currencyFlagClass } from '@/lib/format';
import type { DepartmentInfo } from '@/lib/domain';

/** Флаг валюты у опции селектора — «Currency» из макета: 40×32, r8. */
function renderCurrencyFlag(opt: SelectOption) {
  return <CurrencyFlag flag={currencyFlagClass(opt.value) ?? 'gold'} className="h-8 !w-10 shrink-0" />;
}

/** Значение в закрытом селекте: флаг + код. */
function renderCurrencyValue(opt: SelectOption) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {renderCurrencyFlag(opt)}
      <span className="truncate font-medium">{opt.value}</span>
    </span>
  );
}

/**
 * Поле суммы с «плавающей» подписью и выбором валюты — блок «Валютная пара».
 * Тот же рисунок поля, что у калькулятора на главной (Calculator.tsx):
 * единая карточка surf2, ячейка валюты справа отделена вертикальной линией.
 * Без currencyOptions/onCurrencyChange сторона валюты статична (например,
 * фиксированная тенге в паре Ecash).
 */
export function AmountBox({
  label,
  value,
  onChange,
  currency,
  currencyOptions,
  onCurrencyChange,
  readOnly,
  invalid,
  className,
  inputId,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  currency: string;
  /** список кодов для смены валюты; без него селектор статичен */
  currencyOptions?: { code: string; name: string }[];
  onCurrencyChange?: (code: string) => void;
  readOnly?: boolean;
  invalid?: boolean;
  className?: string;
  inputId?: string;
}) {
  const t = useTranslations('flows');
  const tCommon = useTranslations('common');
  const autoId = useId();
  const id = inputId ?? autoId;
  const flag = currencyFlagClass(currency);
  const canPick = Boolean(currencyOptions?.length && onCurrencyChange);
  const filled = value !== '';

  const options: SelectOption[] = (currencyOptions ?? []).map((o) => ({
    value: o.code,
    label: o.code,
    hint: o.name,
  }));

  return (
    <div
      className={clsx(
        'flex h-14 flex-none rounded-2xl border bg-surface-page-surf2 transition-colors focus-within:bg-comp-surface2-hover sm:h-[66px] lg:flex-1',
        invalid ? 'border-negative' : 'border-transparent has-[label>input:focus]:border-stroke-brand',
        className,
      )}
    >
      <label
        htmlFor={id}
        className={clsx(
          'flex min-w-0 flex-1 cursor-text flex-col justify-center self-stretch px-4 sm:px-5',
          filled && 'gap-1',
        )}
      >
        <span className={clsx('truncate text-text-disabled', filled ? 'text-xs font-bold' : 'sr-only')}>
          {label}
        </span>
        <input
          id={id}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder={label}
          aria-invalid={invalid || undefined}
          className="w-full min-w-0 bg-transparent text-base font-medium text-text-default outline-none placeholder:font-medium placeholder:text-text-disabled"
        />
      </label>
      {canPick ? (
        <Select
          value={currency}
          options={options}
          onChange={(v) => onCurrencyChange!(v)}
          label={label}
          placeholder={currency}
          renderValue={renderCurrencyValue}
          renderLeading={renderCurrencyFlag}
          searchable
          arrow="chevron"
          searchPlaceholder={t('pair.searchCurrency')}
          noResultsText={tCommon('nothingFound')}
          className="flex w-[136px] shrink-0 self-stretch border-l border-l-surface-page-surf1 min-[480px]:w-[140px] [&>button]:h-auto [&>button]:gap-1 [&>button]:rounded-none [&>button]:rounded-r-[15px] [&>button]:border-0 [&>button]:px-4 [&>button]:aria-expanded:inset-ring-1 [&>button]:aria-expanded:inset-ring-stroke-brand [&>button>span:first-child]:flex [&>button>span:first-child]:items-center sm:[&>div]:left-auto sm:[&>div]:right-0 sm:[&>div]:w-[290px] [&>span]:sr-only"
        />
      ) : (
        <div
          aria-hidden
          className="flex w-[136px] shrink-0 items-center gap-2 self-stretch border-l border-l-surface-page-surf1 px-4 min-[480px]:w-[140px]"
        >
          <CurrencyFlag flag={flag ?? 'gold'} className="h-8 !w-10 shrink-0" />
          <span className="truncate font-medium text-text-default">{currency}</span>
        </div>
      )}
    </div>
  );
}

/** Строка адреса/графика: иконка 20 (16 на мобиле) + текст, зазор 8. */
function InfoRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    // «Frame 1437254872» 511:17776 — строка 20px с 768 и 16px ниже, зазор 8
    <div className="flex h-4 items-center gap-2 md:h-5">
      <Icon name={icon} size={20} className="shrink-0 text-base! text-text-default md:text-xl!" />
      {children}
    </div>
  );
}

/** Текст строки: 14/15.4 ниже 768, 16/21 SemiBold с трекингом −0.31 с 768. */
const rowText =
  'text-sm leading-[15.4px] md:text-base md:font-semibold md:leading-[21px] md:tracking-[-0.31px]';

/** Адрес выбранного отделения + бейдж и плашка «в другом отделении выгоднее». */
export function BranchAddress({
  department,
  nearest,
  betterOffer,
  onPickBetter,
}: {
  department: DepartmentInfo | null;
  nearest?: boolean;
  /** {depId, address, rate} из best-rate, если выгоднее текущего */
  betterOffer?: { depId: number; address: string; rate: number } | null;
  onPickBetter?: (depId: number) => void;
}) {
  const t = useTranslations('flows.address');
  const tb = useTranslations('branches');

  return (
    <div>
      <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
        {t('title')}
      </h2>
      {/* «Frame 1437255099» 511:17768 — бейдж и строки колонкой с зазором 8 */}
      <div className="mt-5 flex flex-col gap-2">
        {nearest && (
          <span className="inline-flex h-[18px] w-fit items-center rounded-lg bg-additional-3 px-2 text-xs font-bold leading-[18px] text-text-always-white">
            {t('nearest')}
          </span>
        )}
        <InfoRow icon="account_balance">
          <span className={clsx('min-w-0 truncate text-text-default', rowText)}>
            {department?.address ?? '—'}
          </span>
        </InfoRow>
        {department?.timetable && (
          <InfoRow icon="schedule">
            <span className={clsx('text-text-default', rowText)}>
              {department.timetable.openTime} - {department.timetable.closeTime}
            </span>
          </InfoRow>
        )}
      </div>

      {betterOffer && (
        <button
          type="button"
          onClick={() => onPickBetter?.(betterOffer.depId)}
          /* «alert» 1000:38497 — зазор 24 до стрелки и две тени; внутри группы
             «Frame 1437254862» зазор 12. Ниже 768 плашка растянута (alignSelf=STRETCH) */
          className="mt-6 flex w-full cursor-pointer items-center gap-6 rounded-2xl bg-surface-page-surf2 p-3 text-left text-base font-medium leading-5 text-text-default shadow-[0_1px_4px_rgb(12_12_13/0.05),0_1px_4px_rgb(12_12_13/0.1)] transition-colors hover:bg-comp-surface2-hover md:mt-7 md:w-auto md:p-4"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Icon name="directions_run" size={32} className="shrink-0 text-brand" />
            <span>
              {t('betterAt')} <span className="text-text-brand">{betterOffer.address}</span>,
              <br />
              {t('betterRate')} ={' '}
              <span className="text-text-positive">
                {betterOffer.rate.toLocaleString('ru-RU')} ₸
              </span>
            </span>
          </span>
          <Icon name="chevron_right" size={24} className="ml-auto shrink-0 text-text-disabled" />
        </button>
      )}
      <span className="sr-only">{tb('onMap')}</span>
    </div>
  );
}

/**
 * Аккордеон «Выбрать тип купюр». Раскрытие больше не выбирает вариант
 * молча — выбор происходит только кликом по конкретному пункту.
 */
export function BanknotesPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const t = useTranslations('flows.banknotes');
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  const open = expanded || value !== null;

  return (
    <div className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
      {!open ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls={listId}
          className="flex cursor-pointer items-center gap-3 text-sm leading-[15.4px] text-text-default transition-opacity hover:opacity-80"
        >
          {/* «Frame 1437255222» 758:23483 — 32×24 с полями 4 по бокам круга,
              за счёт этого подпись начинается на 44px от края блока */}
          <span className="flex h-6 shrink-0 items-center px-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-text-always-white">
              <Icon name="add" size={16} />
            </span>
          </span>
          {t('choose')}
        </button>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              onChange(null);
            }}
            aria-expanded
            aria-controls={listId}
            className="flex cursor-pointer items-center gap-3 text-sm text-text-default transition-opacity hover:opacity-80"
          >
            <Icon name="cancel" size={24} className="shrink-0" />
            {t('label')}
          </button>
          <div
            id={listId}
            role="radiogroup"
            aria-label={t('label')}
            className="mt-7 flex flex-col gap-4"
          >
            {(['small', 'large'] as const).map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-3 text-lg font-medium leading-5 text-text-default"
              >
                <input
                  type="radio"
                  name="banknotes"
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  className="peer sr-only"
                />
                <span
                  className={clsx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand',
                    value === opt
                      ? 'border-transparent bg-btn-2 text-text-default'
                      : 'border-stroke-surface3 text-transparent',
                  )}
                >
                  <Icon name="check" size={19} />
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
