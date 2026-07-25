'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { BranchMap, type BranchMapMarker } from '@/components/ui/BranchMap';
import {
  SuggestionList,
  saveGuestAddress,
  useAddressSuggestions,
  useGuestAddress,
  useSuggestionNav,
} from '@/components/layout/AddressDropdown';
import { useAuth } from '@/lib/auth';
import { formatBranchAddress } from '@/lib/branch-address';
import { useBranchPoints, useGeolocate } from '@/lib/branch-points';
import { useErrorText } from '@/lib/useErrorText';
import { api } from '@/lib/api';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Модалка «Укажите свой адрес» — экран «modal window adress» (1404:111738,
 * карточка 1404:111750); адаптивы 768 `1395:104269`, 480 `1395:106025`,
 * 360 `1395:104750`.
 *
 * Спека ≥1024: подложка #000000 60 %, карточка 952×818, p40, gap36, r20,
 * fill #262626, border 1px #333333; заголовок 32/500 lh38.4 по центру,
 * подпись 16/400; строка «поле 741×54 + кнопка 121×54» (поле — `dropdown
 * location poned`, то есть с РАСКРЫТЫМ списком подсказок 741×580 @0,58:
 * fill #333333, border 1px #404040, r20, строки 49 r12); карта 869×548 r20;
 * крестик 44×44 r40 вне карточки справа сверху (+16 по x, +14.5 по y).
 *
 * Спека ≤480: карточка во весь экран без радиуса, p 44/16/16/16, main:between —
 * «заголовок + поле» сверху (внутренний gap 20), карта тянется, «Сохранить»
 * на всю ширину прижата к низу, крестик внутри правого верхнего угла.
 * На карте — пилюля «Развернуть на весь экран» (242×38, r20, 14/500).
 */
export function AddressModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations('addressModal');
  const { account, authed, invalidate } = useAuth();
  const errorText = useErrorText();
  const titleId = useId();
  const inputId = useId();
  const listId = useId();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const guestAddress = useGuestAddress();
  const [address, setAddress] = useState('');
  const [focused, setFocused] = useState(false);
  /** ≤480: карта раскрыта на весь лист (пилюля из макета). */
  const [expanded, setExpanded] = useState(false);
  /** Пользователь уже правил поле — поздняя синхронизация его не затрёт. */
  const [dirty, setDirty] = useState(false);

  /* ------------------------------------------------- отделения и карта ---- */

  // грузим только у открытой модалки; ключи общие с /locations и профилем
  const { points, loading: pointsLoading } = useBranchPoints({ enabled: open });

  /** Введённый адрес совпал с отделением — подсвечиваем его пин и центрируем карту. */
  const matched = useMemo(() => {
    const needle = address.trim().toLowerCase();
    if (!needle) return null;
    return points.find((p) => p.address.toLowerCase() === needle) ?? null;
  }, [address, points]);

  const markers = useMemo<BranchMapMarker[]>(
    () =>
      points.map((p) => ({
        id: p.depId,
        lat: p.lat,
        lon: p.lon,
        // в подписи пина — человекочитаемый адрес, а не сырая строка Ecash
        label: formatBranchAddress(p.address),
        active: p.depId === matched?.depId,
      })),
    [points, matched],
  );

  // объект пересоздаётся только при смене отделения — карта не дёргается
  const center = useMemo(
    () => (matched ? { lat: matched.lat, lon: matched.lon } : undefined),
    [matched],
  );

  const geo = useGeolocate(points, (p) => {
    setAddress(p.address);
    setDirty(true);
    setFocused(false);
  });
  const geoReset = geo.reset;

  /* ------------------------------------------------------- подсказки ------ */

  // enabled по `open`, а не по фокусу: список открывается уже наполненным
  const { suggestions } = useAddressSuggestions(address, { enabled: open });
  const nav = useSuggestionNav(suggestions.length, (i) => setAddress(suggestions[i]));
  const navReset = nav.reset;
  const showList = focused && suggestions.length > 0;

  /* -------------------------------------------------------- сохранение --- */

  const save = useMutation({
    mutationFn: (value: string) => api.profile.save({ address: value }),
    onSuccess: () => invalidate(),
  });
  const resetSave = save.reset;

  /** Сохранённый адрес: у авторизованного — из профиля, у гостя — из localStorage. */
  const source = (authed ? account?.profile.address : guestAddress) ?? '';

  // Подставляем сохранённый адрес при открытии — правка состояния во время
  // рендера — штатный способ синхронизации, без эффекта. Пересинхронизируемся
  // и позже: сессия может приехать уже после открытия модалки, и тогда поле
  // обязано наполниться, а не остаться пустым. Правки пользователя при этом
  // не затираем — за этим следит `dirty`.
  const [syncedSource, setSyncedSource] = useState<string | null>(null);
  if (open) {
    if (syncedSource === null || (!dirty && syncedSource !== source)) {
      setSyncedSource(source);
      setAddress(source);
      // каждое открытие начинается с чистого листа: без подсказок и обычная карта
      setFocused(false);
      setExpanded(false);
    }
  } else if (syncedSource !== null) {
    setSyncedSource(null);
    setDirty(false);
  }

  // Фокус: запоминаем инициатора, переводим фокус в поле, возвращаем при закрытии.
  useEffect(() => {
    if (!open) return;
    resetSave();
    geoReset();
    navReset();
    const prev = document.activeElement;
    // preventScroll: на коротком вьюпорте (1366×768) обычный focus прокручивает
    // скроллящуюся подложку к полю, унося заголовок карточки выше края экрана.
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [open, resetSave, geoReset, navReset]);

  // Esc, ловушка Tab внутри модалки и блокировка прокрутки под ней.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Esc уже обработан полем (закрыл подсказки) — модалка остаётся
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        // раскрытая карта сворачивается первым Esc, вторым закрывается модалка
        if (expanded) {
          setExpanded(false);
          return;
        }
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      // Скрытые кнопки (пилюля карты на ≥640, контролы под раскрытой картой)
      // тоже попадают в querySelectorAll, но фокус на display:none не встаёт —
      // берём только отрисованные, иначе Tab упирается в невидимый элемент.
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, expanded]);

  const submit = () => {
    if (save.isPending) return;
    const next = address.trim();
    // гость: адрес сохраняется в localStorage — введённое не выбрасывается
    if (!authed) {
      saveGuestAddress(next);
      onSaved?.();
      onClose();
      return;
    }
    save.mutate(next, {
      onSuccess: () => {
        onSaved?.();
        onClose();
      },
      // при ошибке модалка не закрывается — текст покажется у поля
    });
  };

  /** Одна живая область: ошибка сохранения важнее статуса геолокации. */
  const status = save.isError
    ? errorText(save.error.message)
    : geo.status === 'pending'
      ? t('locating')
      : geo.status === 'denied'
        ? t('locateDenied')
        : geo.status === 'unsupported' || geo.status === 'empty'
          ? t('locateEmpty')
          : '';

  if (!open) return null;

  return (
    <>
      {/*
        Раньше подложка и карточка анимировались через framer-motion
        (opacity 0→1, JS/rAF-драйвер). Баг: если вкладка уходит в фон в
        момент открытия (свайп на телефоне, alt-tab, DevTools) — браузер
        ставит rAF на паузу, и framer-motion застревает на промежуточном
        кадре НАВСЕГДА (напр. opacity: 0.42) — подложка и карточка остаются
        полупрозрачными, страница просвечивает насквозь до перезагрузки.
        anim-modal-scrim/card — чистый CSS с animation-fill-mode: both:
        конечное состояние гарантировано независимо от rAF и видимости вкладки.
      */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions --
          стандартный паттерн «клик по подложке закрывает модалку»; клавиатурный
          выход — Esc (обработан ниже), мышиный — сюда, обе не мешают друг другу */}
      <div
        className="anim-modal-scrim fixed inset-0 z-50 flex justify-center overflow-y-auto bg-scrim sm:p-4 sm:py-10"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          ref={containerRef}
          // sm:items-center на подложке нельзя: карточка выше вьюпорта (832
          // против 720 на ноутбуках 1366×768) обрезалась бы сверху и
          // доскроллить до заголовка было бы нельзя. Авто-маржины на самой
          // карточке центрируют, когда она влезает, и честно скроллятся,
          // когда нет.
          className="anim-modal-card relative flex w-full sm:my-auto sm:max-w-[952px]"
        >
            {/* ≤1024 крестик внутри правого верхнего угла листа, ≥1024 — снаружи */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="absolute right-0 top-0 z-30 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface2-hover sm:right-2 sm:top-2 lg:-right-[60px] lg:top-3.5"
            >
              <Icon name="close" size={20} />
            </button>

            <div className="flex min-h-[100dvh] w-full flex-col gap-5 border-stroke-surface1 bg-surface-page-surf1 p-4 pt-11 sm:min-h-0 sm:gap-9 sm:rounded-[20px] sm:border sm:p-10">
              <div
                className={clsx('flex flex-col gap-1 text-center', expanded && 'hidden sm:flex')}
              >
                <h2
                  id={titleId}
                  className="text-xl font-medium leading-tight text-text-default sm:text-[32px]"
                >
                  {t('title')}
                </h2>
                <p className="text-sm text-text-default sm:text-base">{t('subtitle')}</p>
              </div>

              {/* ≤640 поле и «Сохранить» — прямые дети листа (contents), поэтому
                  кнопка уезжает к нижнему краю (main:between макета) */}
              <div className="contents sm:flex sm:items-start sm:gap-2">
                <div
                  className={clsx(
                    'relative order-2 sm:order-none sm:flex-1',
                    expanded && 'hidden sm:block',
                  )}
                >
                  <div className="flex h-[54px] items-center gap-2 rounded-[20px] border border-stroke-surface3 px-4 transition-colors focus-within:border-stroke-brand">
                    <label htmlFor={inputId} className="sr-only">
                      {t('placeholder')}
                    </label>
                    <input
                      id={inputId}
                      ref={inputRef}
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        setDirty(true);
                        navReset();
                        geoReset();
                      }}
                      onFocus={() => setFocused(true)}
                      onBlur={() => {
                        setFocused(false);
                        navReset();
                      }}
                      onKeyDown={(e) => {
                        if (nav.onKeyDown(e)) return;
                        if (e.key === 'Escape' && showList) {
                          // гасим событие, иначе document-обработчик закроет модалку
                          e.preventDefault();
                          setFocused(false);
                          navReset();
                          return;
                        }
                        if (e.key === 'Enter') submit();
                      }}
                      placeholder={t('placeholder')}
                      maxLength={300}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={showList}
                      aria-controls={listId}
                      aria-activedescendant={
                        nav.activeIndex >= 0 ? `${listId}-opt-${nav.activeIndex}` : undefined
                      }
                      className="w-full bg-transparent text-base font-medium text-text-default outline-none placeholder:text-text-disabled"
                    />
                    {address && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddress('');
                          setDirty(true);
                          navReset();
                          geoReset();
                          inputRef.current?.focus();
                        }}
                        aria-label={t('clear')}
                        className="cursor-pointer text-text-disabled transition-colors hover:text-text-default"
                      >
                        <Icon name="cancel" size={20} />
                      </button>
                    )}
                  </div>

                  {showList && (
                    <SuggestionList
                      id={listId}
                      suggestions={suggestions}
                      activeIndex={nav.activeIndex}
                      selected={address.trim()}
                      onPick={(v) => {
                        setAddress(v);
                        setDirty(true);
                        navReset();
                        inputRef.current?.focus();
                      }}
                      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(580px,45vh)] overflow-y-auto rounded-[20px] border border-stroke-modal bg-surface-modal-bg p-2 shadow-[0_0_6px_rgb(0_0_0/0.12)]"
                    />
                  )}

                  <p aria-live="polite" className="min-h-5 pl-1 text-sm text-text-negative">
                    {status}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={submit}
                  disabled={save.isPending}
                  className={clsx(
                    'order-4 mt-auto inline-flex h-[54px] w-full shrink-0 cursor-pointer items-center justify-center rounded-[20px] bg-btn-brand px-6 text-sm font-medium text-text-always-white transition-[filter] hover:brightness-110 disabled:opacity-60 sm:order-none sm:mt-0 sm:w-[121px]',
                    expanded && 'hidden sm:inline-flex',
                  )}
                >
                  {t('save')}
                </button>
              </div>

              {/* Настоящая карта отделений вместо статичной картинки: обещание
                  «покажем ближайшие обменники» должно быть правдой. */}
              <div
                className={clsx(
                  'overflow-hidden bg-surface-page-surf2',
                  // высоты по адаптивам макета: 768 → 498, ≥1024 → 548
                  expanded
                    ? 'absolute inset-0 z-20 sm:relative sm:inset-auto sm:z-auto sm:h-[420px] sm:rounded-[20px] md:h-[498px] lg:h-[548px]'
                    : 'relative order-3 min-h-[220px] flex-1 rounded-[20px] sm:h-[420px] sm:min-h-0 sm:flex-none md:h-[498px] lg:h-[548px]',
                )}
              >
                <BranchMap
                  markers={markers}
                  center={center}
                  // после «Рядом со мной» показываем и саму позицию пользователя
                  userPos={geo.position}
                  onMarkerClick={(id) => {
                    // клик по пину — тоже выбор адреса, не только ввод руками
                    const point = points.find((p) => p.depId === id);
                    if (!point) return;
                    setAddress(point.address);
                    setDirty(true);
                    setFocused(false);
                    geoReset();
                  }}
                  label={t('mapAlt')}
                  // пока отделения грузятся, «не найдены» было бы неправдой
                  emptyText={pointsLoading ? t('mapLoading') : t('mapEmpty')}
                  className="h-full w-full"
                />

                <button
                  type="button"
                  onClick={geo.locate}
                  disabled={geo.status === 'pending' || points.length === 0}
                  aria-label={t('locate')}
                  className="absolute right-3 top-3 z-10 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[20px] bg-surface-inverted px-3 text-sm font-medium text-text-inverted shadow-[0_2px_8px_rgb(0_0_0/0.25)] transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <Icon
                    name={geo.status === 'pending' ? 'progress_activity' : 'my_location'}
                    size={18}
                    className={clsx(geo.status === 'pending' && 'animate-spin')}
                  />
                  <span className="hidden sm:inline">{t('locate')}</span>
                </button>

                {/* пилюля из адаптива ≤480: карта на весь лист и обратно */}
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  // bottom-8, а не 16 по макету: ниже проходит полоса атрибуции
                  // OpenStreetMap, которой в макете нет
                  className="absolute bottom-8 left-1/2 z-10 inline-flex h-[38px] -translate-x-1/2 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[20px] bg-surface-inverted pl-4 pr-6 text-sm font-medium text-text-inverted shadow-[0_2px_8px_rgb(0_0_0/0.25)] transition-opacity hover:opacity-90 sm:hidden"
                >
                  <Icon name={expanded ? 'close_fullscreen' : 'open_in_full'} size={20} />
                  {expanded ? t('mapCollapse') : t('mapExpand')}
                </button>
              </div>
            </div>
        </div>
      </div>
    </>
  );
}
