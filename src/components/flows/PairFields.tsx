'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Iconsax } from '@/components/ui/Iconsax';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { currencyFlagClass } from '@/lib/format';
import type { DepartmentInfo } from '@/lib/domain';

/** Поле суммы с плавающим лейблом и выбором валюты — блок «Валютная пара». */
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const id = inputId ?? autoId;
  const flag = currencyFlagClass(currency);
  const canPick = Boolean(currencyOptions?.length && onCurrencyChange);

  /** Опции после фильтра поиска по коду/названию — как в Select.tsx. */
  const visibleOptions = useMemo(() => {
    if (!currencyOptions) return [];
    const q = query.trim().toLowerCase();
    if (!q) return currencyOptions;
    return currencyOptions.filter((o) => [o.code, o.name].some((s) => s.toLowerCase().includes(q)));
  }, [currencyOptions, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const toggleOpen = () => {
    if (open) {
      close();
      return;
    }
    setQuery('');
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={clsx(
        // border всегда (прозрачный в покое): invalid-рамка не сдвигает
        // разметку, фокус — брендовая обводка по радиусу поля, единая для всех полей сайта;
        // при ошибке красная рамка держится и в фокусе (focus-* победил бы
        // по специфичности и прятал бы её во время правки поля)
        // обводка — только от инпута суммы (has-[label>input:focus]):
        // focus-within ловил и автофокус поиска в открытом селекторе валюты —
        // выходило два оранжевых кольца разом (тот же приём, что в Calculator)
        'relative flex flex-1 items-center rounded-2xl border bg-surface-page-surf2 transition-colors',
        invalid ? 'border-negative' : 'border-transparent has-[label>input:focus]:border-stroke-brand',
        className,
      )}
    >
      <label htmlFor={id} className="min-w-0 flex-1 px-4 py-2">
        <span className="block text-[11px] leading-tight text-text-disabled">{label}</span>
        <input
          id={id}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          inputMode="decimal"
          placeholder=" "
          aria-invalid={invalid || undefined}
          className="w-full bg-transparent text-base text-text-default outline-none placeholder:text-text-disabled"
        />
      </label>
      <button
        type="button"
        onClick={canPick ? toggleOpen : undefined}
        aria-haspopup={canPick ? 'listbox' : undefined}
        aria-expanded={canPick ? open : undefined}
        aria-label={canPick ? t('pair.pickCurrency') : undefined}
        tabIndex={canPick ? 0 : -1}
        className={clsx(
          'm-2 inline-flex shrink-0 items-center gap-2 rounded-xl bg-surface-modal-surf1 px-3 py-2 text-base font-medium text-text-default transition-colors',
          canPick ? 'cursor-pointer hover:bg-comp-surface2-hover' : 'cursor-default',
        )}
      >
        {/* !-префикс: у flag-icons свой .fi{width:1.333333em} перебивает w-9 той же специфичности */}
        <CurrencyFlag flag={flag ?? 'gold'} className="h-6 !w-9" />
        {currency}
        {canPick && <Icon name="keyboard_arrow_down" size={18} />}
      </button>

      {open && canPick && (
        <div className="absolute right-2 top-full z-30 mt-1 w-64 rounded-2xl border border-stroke-modal bg-surface-modal-surf1 p-1.5 shadow-xl">
          <div className="relative mb-1.5">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled"
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('pair.searchCurrency')}
              aria-label={t('pair.searchCurrency')}
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full rounded-xl border border-stroke-modal bg-transparent pl-10 pr-3 text-sm text-text-default outline-none transition-colors placeholder:text-text-disabled focus:border-stroke-brand"
            />
          </div>
          <ul role="listbox" aria-label={t('pair.pickCurrency')} className="max-h-60 overflow-auto">
            {visibleOptions.map((opt) => (
              <li key={opt.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.code === currency}
                  onClick={() => {
                    onCurrencyChange!(opt.code);
                    close();
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-comp-surface1-hover"
                >
                  <CurrencyFlag flag={currencyFlagClass(opt.code) ?? 'gold'} className="h-5 !w-8" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm text-text-default">{opt.code}</span>
                    <span className="truncate text-xs text-text-disabled">{opt.name}</span>
                  </span>
                  {opt.code === currency && (
                    <Icon name="check" size={16} className="ml-auto shrink-0" />
                  )}
                </button>
              </li>
            ))}
            {visibleOptions.length === 0 && (
              <li role="presentation" className="px-3 py-2.5 text-sm text-text-disabled">
                {tCommon('nothingFound')}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

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
      <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('title')}</h2>
      <div className="mt-3">
        {nearest && (
          <span className="rounded-md bg-additional-3 px-2 py-0.5 text-[11px] font-medium text-text-always-white">
            {t('nearest')}
          </span>
        )}
        <div className="mt-2 flex items-center gap-2 text-base text-text-default">
          <Iconsax name="bank" size={18} className="shrink-0 text-text-disabled" />
          <span className="min-w-0 truncate">{department?.address ?? '—'}</span>
        </div>
        {department?.timetable && (
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            <Iconsax name="clock" size={16} className="text-text-disabled" />
            <span className="text-text-default">
              {department.timetable.openTime} - {department.timetable.closeTime}
            </span>
          </div>
        )}
      </div>

      {betterOffer && (
        <button
          type="button"
          onClick={() => onPickBetter?.(betterOffer.depId)}
          className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-page-surf2 px-4 py-3 text-left text-sm text-text-default transition-colors hover:bg-comp-surface2-hover"
        >
          <Icon name="directions_run" size={20} className="text-brand" />
          <span>
            {t('betterAt')} <span className="text-text-brand">{betterOffer.address}</span>,
            <br />
            {t('betterRate')} ={' '}
            <span className="text-text-positive">
              {betterOffer.rate.toLocaleString('ru-RU')} ₸
            </span>
          </span>
          <Icon name="chevron_right" size={20} className="ml-2 shrink-0 text-text-disabled" />
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
    <div className="rounded-2xl bg-surface-page-surf1 px-5 py-4 sm:rounded-3xl sm:px-8 sm:py-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls={listId}
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
            onClick={() => {
              setExpanded(false);
              onChange(null);
            }}
            aria-expanded
            aria-controls={listId}
            className="flex cursor-pointer items-center gap-3 text-sm text-text-disabled transition-colors hover:text-text-default"
          >
            <Icon name="cancel" size={20} />
            {t('label')}
          </button>
          <div id={listId} role="radiogroup" aria-label={t('label')} className="mt-3 flex flex-col gap-2">
            {(['small', 'large'] as const).map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-3 text-base text-text-default"
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
                    'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand',
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
