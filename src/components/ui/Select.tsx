'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Icon } from './Icon';

/**
 * Доступный селект в стилистике макета: роли combobox/listbox,
 * стрелки/Home/End/Esc, закрытие по клику вне, видимый фокус.
 * С searchable внутри попапа появляется поле поиска: фильтрация опций
 * по подстроке (label + hint + value, без учёта регистра), клавиатурная
 * навигация работает по отфильтрованному списку.
 */

export type SelectOption = { value: string; label: string; hint?: string };

export function Select({
  value,
  options,
  onChange,
  label,
  placeholder,
  className,
  buttonClassName,
  renderValue,
  renderLeading,
  searchable = false,
  searchPlaceholder,
  noResultsText,
}: {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** видимая подпись поля (связывается с кнопкой) */
  label: string;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  renderValue?: (opt: SelectOption) => React.ReactNode;
  /**
   * Ведущий визуал строки списка (флаг валюты). В макете он стоит СЛЕВА от
   * пары «код / название», а не над ней — отсюда высота строки 56px.
   */
  renderLeading?: (opt: SelectOption) => React.ReactNode;
  /** поле поиска внутри попапа; запрос сбрасывается при открытии/закрытии */
  searchable?: boolean;
  /** плейсхолдер поля поиска (i18n) — нужен при searchable */
  searchPlaceholder?: string;
  /** текст пустой выдачи (i18n) — нужен при searchable */
  noResultsText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  /** Опции после фильтра поиска; без searchable/запроса — исходный список. */
  const visible = useMemo(() => {
    if (!searchable) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      [o.label, o.value, o.hint ?? ''].some((s) => s.toLowerCase().includes(q)),
    );
  }, [options, query, searchable]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (refocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, close]);

  /** открытие: активная позиция ставится в обработчике, не в эффекте */
  const openList = useCallback(() => {
    setQuery('');
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
    setActive(idx);
    setOpen(true);
    requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)?.scrollIntoView({
        block: 'nearest',
      });
    });
  }, [options, value, searchable]);

  const commit = useCallback(
    (idx: number) => {
      const opt = visible[idx];
      if (!opt) return; // пустая выдача поиска — нечего выбирать
      onChange(opt.value);
      close(true);
    },
    [onChange, visible, close],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    // В поле поиска пробел и Home/End принадлежат вводу текста.
    const inSearch = searchable && e.target === searchRef.current;
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close(true);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (visible.length > 0) setActive((v) => Math.min(visible.length - 1, v + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (visible.length > 0) setActive((v) => Math.max(0, v - 1));
        break;
      case 'Home':
        if (inSearch) return;
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        if (inSearch) return;
        e.preventDefault();
        if (visible.length > 0) setActive(visible.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        commit(active);
        break;
      case ' ':
        if (inSearch) return;
        e.preventDefault();
        commit(active);
        break;
    }
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({
      block: 'nearest',
    });
  }, [active, open]);

  const activeId = open && visible.length > 0 && active >= 0 ? `${id}-opt-${active}` : undefined;

  const listbox = (
    <ul
      ref={listRef}
      id={`${id}-list`}
      role="listbox"
      aria-labelledby={`${id}-label`}
      className={
        searchable
          ? 'max-h-72 overflow-auto'
          : // попап «Frame 1437254896»: r20, p8, обводка stroke/modal, тень 0 0 6px 12%
            'absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-[20px] border border-stroke-modal bg-surface-modal-bg p-2 shadow-[0_0_6px_rgb(0_0_0/0.12)]'
      }
    >
      {visible.map((opt, idx) => (
        <li
          key={opt.value}
          id={`${id}-opt-${idx}`}
          data-idx={idx}
          role="option"
          aria-selected={opt.value === value}
          onPointerDown={(e) => {
            e.preventDefault();
            commit(idx);
          }}
          onPointerMove={() => setActive(idx)}
          className={clsx(
            'flex cursor-pointer items-center justify-between gap-4 rounded-xl py-2 text-base text-text-default transition-colors',
            // с флагом — «dropdown currency item list» 56×r12, паддинг 8/16/8/8;
            // без него — строка списка адресов 49×r12 с паддингом 8/16 (1347:80046)
            renderLeading ? 'min-h-14 pl-2 pr-4' : 'min-h-[49px] px-4',
            idx === active
              ? 'bg-surface-modal-surf1-hover'
              : opt.value === value
                ? 'bg-surface-modal-surf1-active'
                : 'bg-transparent',
          )}
        >
          {/* «Frame 1437254940»: флаг + колонка «код / название», всё 40px в высоту */}
          <span className="flex min-w-0 items-center gap-3">
            {renderLeading?.(opt)}
            <span
              className={clsx('flex min-w-0 flex-col justify-center', !renderLeading && 'gap-0.5')}
            >
              {/* валюта: код SemiBold 16/20 + название Bold 12/1.2×;
                  адрес: строка Regular 14/1.1× + подпись Medium 12/1.3× */}
              <span
                className={clsx(
                  'truncate',
                  renderLeading ? 'font-semibold leading-5' : 'text-sm leading-[1.1]',
                )}
              >
                {renderLeading ? opt.label : renderValue ? renderValue(opt) : opt.label}
              </span>
              {opt.hint && (
                <span
                  className={clsx(
                    'truncate text-xs text-text-disabled',
                    renderLeading ? 'font-bold leading-[1.2]' : 'font-medium leading-[1.3]',
                  )}
                >
                  {opt.hint}
                </span>
              )}
            </span>
          </span>
          {/* радио-индикатор: пустой круг surf1 модалки / брендовый с галочкой */}
          <span
            aria-hidden
            className={clsx(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors',
              opt.value === value ? 'bg-brand' : 'bg-surface-modal-surf1',
            )}
          >
            {opt.value === value && (
              <Icon name="done" size={12} className="text-text-always-white" />
            )}
          </span>
        </li>
      ))}
      {searchable && visible.length === 0 && (
        <li role="presentation" className="px-3 py-4 text-sm text-text-disabled">
          {noResultsText}
        </li>
      )}
    </ul>
  );

  return (
    // Контейнер составного виджета: onKeyDown обслуживает клавиатуру
    // комбобокса (стрелки/Enter/Esc), фокус живёт на кнопке ниже.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div ref={rootRef} className={clsx('relative', className)} onKeyDown={onKeyDown}>
      <span
        id={`${id}-label`}
        className="mb-1 block text-xs font-bold leading-[1.2] text-text-disabled"
      >
        {label}
      </span>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label`}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={searchable ? undefined : activeId}
        onClick={() => (open ? close(false) : openList())}
        className={clsx(
          // геометрия «Input» M: 54×r20, паддинг 16, текст Roboto Medium 16/20
          'flex h-[54px] w-full cursor-pointer items-center justify-between gap-2 rounded-[20px] border bg-transparent px-4 text-left text-base font-medium leading-5 text-text-default transition-colors',
          // раскрытый селект в макете подсвечен брендовой обводкой
          open
            ? 'border-stroke-brand'
            : 'border-surface-page-surf3 hover:bg-surface-page-surf2 hover:border-stroke-surface3',
          buttonClassName,
        )}
      >
        <span className={clsx('truncate', !selected && 'text-text-disabled')}>
          {selected ? (renderValue ? renderValue(selected) : selected.label) : (placeholder ?? '—')}
        </span>
        {/* в макете это заливной треугольник arrow_down (10.67×6), не «птичка»
            keyboard_arrow_down — ближайший аналог в Material Symbols */}
        <Icon
          name="arrow_drop_down"
          size={16}
          className={clsx('shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open &&
        (searchable ? (
          // Попап с поиском: обёртка несёт стили списка, ul остаётся listbox.
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-[20px] border border-stroke-modal bg-surface-modal-bg p-2 shadow-[0_0_6px_rgb(0_0_0/0.12)]">
            {/* «search field S»: 52×r12 на surf1 модалки, брендовая обводка в фокусе */}
            <div className="mb-4 flex h-13 items-center gap-3 rounded-xl border border-surface-modal-surf1 bg-surface-modal-surf1 px-4 transition-colors focus-within:border-stroke-brand">
              <Icon name="search" size={24} className="shrink-0 text-text-default" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={`${id}-list`}
                aria-activedescendant={activeId}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                // «Input txt S» — Roboto Medium 14/20, плейсхолдер SemiBold 14/20
                className="w-full min-w-0 bg-transparent text-sm font-medium leading-5 text-text-default outline-none placeholder:font-semibold placeholder:text-text-disabled"
              />
            </div>
            {listbox}
          </div>
        ) : (
          listbox
        ))}
    </div>
  );
}
