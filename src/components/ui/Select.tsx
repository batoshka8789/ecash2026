'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useMediaQuery } from '@/lib/hooks';
import { Icon } from './Icon';
import { MobileSheet } from './MobileSheet';

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
  arrow = 'triangle',
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
  /**
   * Значок раскрытия. По умолчанию заливной треугольник — так нарисовано
   * большинство селектов макета. У валютных полей калькулятора это «птичка»,
   * поэтому там передаётся chevron.
   */
  arrow?: 'triangle' | 'chevron';
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const isMobile = useMediaQuery('(max-width: 639px)');

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

  /** «search field S»: 52×r12 на surf1 модалки, брендовая обводка в фокусе — общий для десктоп-попапа и мобильного шита */
  const searchField = (
    <div className="flex h-13 items-center gap-3 rounded-xl border border-transparent bg-surface-modal-surf1 px-4 transition-colors focus-within:border-stroke-brand">
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
        className="w-full min-w-0 bg-transparent text-base text-text-default outline-none placeholder:text-sm placeholder:font-semibold placeholder:text-text-disabled"
      />
    </div>
  );

  // на мобильном шите скролл и рамки задаёт обёртка самого шита
  const listbox = (
    <ul
      ref={listRef}
      id={`${id}-list`}
      role="listbox"
      aria-labelledby={`${id}-label`}
      className={
        isMobile
          ? undefined
          : searchable
            ? 'max-h-72 overflow-auto'
            : 'absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-[20px] border border-stroke-modal bg-surface-page-surf2 p-2 shadow-[0_0_6px_rgba(0,0,0,0.12)]'
      }
    >
      {visible.map((opt, idx) => (
        <li
          key={opt.value}
          id={`${id}-opt-${idx}`}
          data-idx={idx}
          role="option"
          aria-selected={opt.value === value}
          // onClick, не onPointerDown: на тач-экране pointerdown стреляет
          // в момент касания — до того, как понятно, тап это или скролл
          // пальцем, и список становится нескроллящимся (пункт «пере
          // хватывал» любое касание). click браузер сам не шлёт, если
          // палец сдвинулся дальше скролл-порога, — ровно то поведение,
          // которое здесь нужно.
          onClick={() => commit(idx)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              commit(idx);
            }
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse') setActive(idx);
          }}
          className={clsx(
            // 56×r12 с паддингом 8/16/8/8 — «dropdown currency item list» из макета
            'flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl py-2 pl-2 pr-4 text-base text-text-default transition-colors',
            idx === active ? 'bg-comp-surface2-hover' : 'bg-transparent',
          )}
        >
          {/* «Frame 1437254940»: флаг + колонка «код / название», всё 40px в высоту */}
          <span className="flex min-w-0 items-center gap-3">
            {renderLeading?.(opt)}
            <span className="flex min-w-0 flex-col justify-center">
              <span className="truncate">
                {renderLeading ? opt.label : renderValue ? renderValue(opt) : opt.label}
              </span>
              {opt.hint && (
                <span className="truncate text-xs font-medium text-text-disabled">{opt.hint}</span>
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
      <span id={`${id}-label`} className="mb-1 block text-sm text-text-disabled">
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
          'flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border bg-transparent px-4 text-left text-base text-text-default transition-colors',
          // раскрытый селект в макете подсвечен брендовой обводкой
          open ? 'border-stroke-brand' : 'border-stroke-modal hover:border-stroke-surface3',
          buttonClassName,
        )}
      >
        <span className={clsx('truncate', !selected && 'text-text-disabled')}>
          {selected ? (renderValue ? renderValue(selected) : selected.label) : (placeholder ?? '—')}
        </span>
        {/* по умолчанию — заливной треугольник arrow_down (10.67×6) из макета;
            arrow="chevron" даёт «птичку» keyboard_arrow_down */}
        <Icon
          name={arrow === 'chevron' ? 'keyboard_arrow_down' : 'arrow_drop_down'}
          size={20}
          className={clsx('shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {isMobile && (
        <MobileSheet open={open} onClose={() => close(false)} header={searchable ? searchField : undefined}>
          {listbox}
        </MobileSheet>
      )}

      {open &&
        !isMobile &&
        (searchable ? (
          // Попап с поиском: обёртка несёт стили списка, ul остаётся listbox.
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-[20px] border border-stroke-modal bg-surface-page-surf2 p-2 shadow-[0_0_6px_rgba(0,0,0,0.12)]">
            <div className="mb-4">{searchField}</div>
            {listbox}
          </div>
        ) : (
          listbox
        ))}
    </div>
  );
}
