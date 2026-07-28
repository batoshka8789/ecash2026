'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
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
  /** Пустое поле в макете — однострочный мастер 116:2137 (плейсхолдер 16/20,
   *  padding 22 16); заполненное — двухуровневый 116:2147 (лейбл 12/16 + значение). */
  const filled = value !== '';

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
        // «swap currency selector» 699:45952 — половина пары: 66px, две плитки
        // surf2 с зазором 1px, скругления 20 только по внешним углам.
        'relative flex h-[66px] flex-1 items-stretch gap-px rounded-[20px]',
        // рамка ошибки внутренней тенью — border сдвинул бы содержимое плитки
        invalid && 'shadow-[inset_0_0_0_1px_var(--color-negative)]',
        className,
      )}
    >
      <label
        htmlFor={id}
        className={clsx(
          'flex min-w-0 flex-1 flex-col justify-center rounded-l-[20px] bg-surface-page-surf2 px-4',
          filled ? 'gap-1.5 py-3' : 'py-[23px]',
        )}
      >
        {filled && (
          <span className="block text-xs font-medium leading-4 text-text-disabled">{label}</span>
        )}
        <input
          id={id}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          inputMode="decimal"
          placeholder={filled ? ' ' : label}
          aria-label={filled ? undefined : label}
          aria-invalid={invalid || undefined}
          className="w-full bg-transparent text-base font-semibold leading-5 text-text-default outline-none placeholder:font-medium placeholder:text-text-disabled"
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
          // «dropdown currency» 116:3180 — 66px, padding 16, флаг 40×32/r8,
          // gap 16 до кода и 4 до стрелки, код 16/20.
          'inline-flex shrink-0 items-center gap-4 rounded-r-[20px] bg-surface-page-surf2 px-4 text-base font-semibold leading-5 text-text-default transition-colors',
          canPick ? 'cursor-pointer hover:bg-comp-surface2-hover' : 'cursor-default',
        )}
      >
        <CurrencyFlag flag={flag ?? 'gold'} className="h-8 w-10 shrink-0 rounded-lg" />
        {/* «Frame 1437254882» 116:2327 — код + стрелка с зазором 4; стрелка стоит
            в обеих плитках макета, в том числе у неизменяемой валюты */}
        <span className="inline-flex items-center gap-1">
          {currency}
          <Icon name="keyboard_arrow_down" size={16} />
        </span>
      </button>

      {open && canPick && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[289px] max-w-[calc(100vw-32px)] rounded-[20px] border border-stroke-modal bg-surface-modal-bg p-2 shadow-[0_0_6px_rgba(0,0,0,0.12)]">
          <div className="relative mb-4">
            <Icon
              name="search"
              size={24}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-default"
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
              className="h-13 w-full rounded-xl border border-transparent bg-surface-modal-surf1 pl-13 pr-4 text-sm text-text-default outline-none transition-colors placeholder:text-text-disabled focus:border-stroke-brand"
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
                  className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl py-2 pl-2 pr-4 text-left transition-colors hover:bg-comp-surface2-hover"
                >
                  <CurrencyFlag
                    flag={currencyFlagClass(opt.code) ?? 'gold'}
                    className="h-10 w-[50px] shrink-0 rounded-[10px]"
                  />
                  <span className="flex min-w-0 flex-col justify-center">
                    <span className="text-base font-semibold leading-5 text-text-default">
                      {opt.code}
                    </span>
                    <span className="truncate text-xs font-bold leading-[1.2] text-text-disabled">
                      {opt.name}
                    </span>
                  </span>
                  {opt.code === currency && (
                    <Icon
                      name="check"
                      size={12}
                      className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-text-always-white"
                    />
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

/** Строка адреса/графика: иконка 20 (16 на мобиле) + текст, точка и хвост. */
function InfoRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    // «Frame 1437254872» 511:17776 — строка 20px с 768 и 16px ниже, зазор 8
    <div className="flex h-4 items-center gap-2 md:h-5">
      <Icon name={icon} size={20} className="shrink-0 text-base! text-text-default md:text-xl!" />
      {children}
    </div>
  );
}

/** Точка-разделитель «Ellipse 7» 4×4 между частями строки. */
const Dot = () => <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-text-default" />;

/** Текст строки: 14/15.4 ниже 768, 16/21 SemiBold с трекингом −0.31 с 768. */
const rowText =
  'text-sm leading-[15.4px] md:text-base md:font-semibold md:leading-[21px] md:tracking-[-0.31px]';

/** «Открыто» считаем по графику отделения: HH:MM сравниваем с текущим временем. */
function isOpenNow(timetable: { openTime: string; closeTime: string }) {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const open = toMin(timetable.openTime);
  const close = toMin(timetable.closeTime);
  if (open === null || close === null) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  // график через полночь (22:00 — 06:00) — интервал разрывный
  return close >= open ? cur >= open && cur < close : cur >= open || cur < close;
}

/** Адрес выбранного отделения + бейдж и плашка «в другом отделении выгоднее». */
export function BranchAddress({
  department,
  nearest,
  distanceKm,
  betterOffer,
  onPickBetter,
}: {
  department: DepartmentInfo | null;
  nearest?: boolean;
  /** расстояние до отделения, км — рисуется после точки-разделителя */
  distanceKm?: number | null;
  /** {depId, address, rate} из best-rate, если выгоднее текущего */
  betterOffer?: { depId: number; address: string; rate: number } | null;
  onPickBetter?: (depId: number) => void;
}) {
  const t = useTranslations('flows.address');
  const tb = useTranslations('branches');
  const openNow = department?.timetable ? isOpenNow(department.timetable) : false;

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
          {distanceKm != null && (
            <>
              <Dot />
              <span className={clsx('shrink-0 text-text-default', rowText)}>
                {distanceKm.toFixed(1)} {t('km')}
              </span>
            </>
          )}
        </InfoRow>
        {department?.timetable && (
          <InfoRow icon="schedule">
            <span className={clsx('text-text-default', rowText)}>
              {department.timetable.openTime} - {department.timetable.closeTime}
            </span>
            {openNow && (
              <>
                <Dot />
                <span className={clsx('shrink-0 text-text-positive', rowText)}>{t('open')}</span>
              </>
            )}
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
