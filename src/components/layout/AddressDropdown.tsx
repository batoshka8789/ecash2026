'use client';

/**
 * Общая механика выбора адреса: хранилище адреса гостя, подсказки по реальным
 * адресам отделений, клавиатурная навигация и сам список подсказок.
 *
 * Переиспользуется модалкой «Укажите свой адрес» (AddressModal), вкладкой
 * «Мой адрес» в профиле и тостом первого визита. Отдельного адресного контрола
 * в шапке нет — макет её так не рисует (Header 1279:104498 — это логотип и три
 * кнопки), поэтому единственная поверхность выбора адреса — модалка.
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/lib/api';

/* ----------------------------------------------- адрес гостя (localStorage)
 *
 * Гость без аккаунта тоже может сохранить адрес: значение живёт
 * в localStorage и читается через внешний стор — сервер всегда рендерит
 * «пусто», клиент подхватывает после гидратации (паттерн firstVisitStore).
 */

const GUEST_KEY = 'ecash.guestAddress';

const guestListeners = new Set<() => void>();
let guestCache: string | undefined;

function subscribeGuest(l: () => void) {
  guestListeners.add(l);
  return () => {
    guestListeners.delete(l);
  };
}

function readGuestAddress(): string {
  if (guestCache === undefined) {
    try {
      guestCache = window.localStorage.getItem(GUEST_KEY) ?? '';
    } catch {
      // приватный режим — адрес проживёт до перезагрузки вкладки
      guestCache = '';
    }
  }
  return guestCache;
}

/** Сохраняет адрес гостя и оповещает всех подписчиков (шапку, модалку). */
export function saveGuestAddress(value: string) {
  guestCache = value;
  try {
    window.localStorage.setItem(GUEST_KEY, value);
  } catch {
    // приватный режим — значение останется в памяти вкладки
  }
  guestListeners.forEach((l) => l());
}

/** Адрес гостя из localStorage; на сервере — пустая строка. */
export function useGuestAddress(): string {
  return useSyncExternalStore(subscribeGuest, readGuestAddress, () => '');
}

/* ------------------------------------------------------ подсказки адресов */

/**
 * Подсказки — substring-фильтр по честным адресам отделений
 * (`/api/departments`), внешних геокодеров нет. Пустой запрос отдаёт
 * первые `limit` адресов — есть что показать сразу после открытия.
 */
export function useAddressSuggestions(
  query: string,
  opts?: { limit?: number; enabled?: boolean },
) {
  const { limit = 6, enabled = true } = opts ?? {};

  const { data } = useQuery({
    queryKey: ['departments'],
    queryFn: ({ signal }) => api.departments.list(signal),
    staleTime: 5 * 60_000,
    enabled,
  });

  // дубли (одно отделение с двумя кассами) схлопываем без учёта регистра
  const addresses = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of data?.departments ?? []) {
      const address = d.address.trim();
      const key = address.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(address);
      }
    }
    return out;
  }, [data]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? addresses.filter((a) => a.toLowerCase().includes(q)) : addresses;
    return pool.slice(0, limit);
  }, [addresses, query, limit]);

  return { addresses, suggestions };
}

/* --------------------------------------------- клавиатурная навигация ---- */

/**
 * Стрелки двигают активную подсказку, Enter по активной — выбирает.
 * `onKeyDown` возвращает true, если событие обработано списком, — иначе
 * вызывающий обрабатывает Enter/Esc сам.
 */
export function useSuggestionNav(count: number, pick: (index: number) => void) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const reset = useCallback(() => setActiveIndex(-1), []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (count === 0) return false;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % count);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
        return true;
      }
      if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < count) {
        e.preventDefault();
        pick(activeIndex);
        setActiveIndex(-1);
        return true;
      }
      return false;
    },
    [count, activeIndex, pick],
  );

  // защёлка от протухшего индекса при сжатии списка
  const active = activeIndex >= 0 && activeIndex < count ? activeIndex : -1;
  return { activeIndex: active, reset, onKeyDown };
}

/* ------------------------------------------------------- список подсказок */

/**
 * Listbox подсказок (Figma: строка r12 p8/16 — адрес 14/400 + «Казахстан»
 * 12/500, галочка справа у выбранного). Выбор мышью идёт через onClick,
 * а mousedown гасится — фокус не покидает input (blur не прячет список).
 */
export function SuggestionList({
  id,
  suggestions,
  activeIndex,
  selected,
  onPick,
  className,
}: {
  id: string;
  suggestions: string[];
  activeIndex: number;
  /** адрес, помеченный галочкой (текущее значение поля) */
  selected?: string;
  onPick: (value: string) => void;
  className?: string;
}) {
  const t = useTranslations('addressDropdown');
  if (suggestions.length === 0) return null;
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={t('suggestions')}
      className={clsx('flex flex-col gap-1', className)}
    >
      {suggestions.map((s, i) => (
        <li
          key={s}
          id={`${id}-opt-${i}`}
          role="option"
          aria-selected={i === activeIndex}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(s)}
          onKeyDown={(e) => {
            // основная навигация — стрелками из input (aria-activedescendant);
            // обработчик здесь — на случай программного фокуса на опции
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPick(s);
            }
          }}
          className={clsx(
            'flex cursor-pointer items-center justify-between gap-4 rounded-xl px-4 py-2 transition-colors',
            i === activeIndex ? 'bg-comp-surface2-hover' : 'hover:bg-comp-surface2-hover',
          )}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm text-text-default">{s}</span>
            <span className="block text-xs font-medium text-text-disabled">{t('country')}</span>
          </span>
          {selected !== undefined && s === selected && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-btn-1 text-text-default">
              <Icon name="check" size={14} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

