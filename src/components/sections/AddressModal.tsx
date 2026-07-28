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
import { useBranchPoints } from '@/lib/branch-points';
import { useErrorText } from '@/lib/useErrorText';
import { api } from '@/lib/api';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Модалка «Укажите свой адрес» — экран «modal window adress» (1404:111738,
 * карточка 1404:111750); адаптивы 768 `1395:104269`, 480 `1395:106025`,
 * 360 `1395:104750`.
 *
 * Спека 1920: подложка #000000 60 %, карточка 952×818, p40, gap36, r20,
 * fill #262626, border 1px #333333; заголовок 32/500 lh38.4, подпись 16/400
 * (обе строки по левому краю); строка «поле 741×54 + кнопка 121×54» (поле —
 * `dropdown location poned`, то есть с РАСКРЫТЫМ списком подсказок 741×580
 * @0,58: fill #333333, border 1px #404040, r20, строки 49 r12); карта 869×548
 * r20; крестик 44×44 r40 вне карточки справа сверху (+16 по x, +14.5 по y).
 *
 * Спека 1024 (1355:102553) и 768 (1395:104269): карточка во весь экран без
 * радиуса, p40, gap36, крестик в правом верхнем углу листа, карта 498.
 *
 * Спека ≤480: карточка во весь экран без радиуса, p 44/16/16/16, main:between —
 * «заголовок + поле» сверху (внутренний gap 20), карта тянется, «Сохранить»
 * на всю ширину прижата к низу, крестик внутри правого верхнего угла.
 * Заголовок 24/500, подпись 14/400. Шаг между блоками — 36 (gap карточки),
 * внутри блока «заголовок ↔ поле» — 20 (Frame 1437255384).
 * На карте — пилюля «Развернуть на весь экран» (242×38, r20, 14/500,
 * fill #F5F3F2, 16 от низа карты); она есть на всех адаптивах до 1920.
 *
 * Своих контролов на карте макет не рисует: ни «Рядом со мной», ни крестика
 * очистки поля (слот иконки «Icon wrapper» 885:33412 стоит visible=false во
 * всех состояниях Input) — поэтому их здесь нет.
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
  /** Панель подсказок. Открывается вводом/кликом, но НЕ автофокусом при
   *  открытии модалки: в макете дефолт — поле без списка (1345:77513). */
  const [listOpen, setListOpen] = useState(false);
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

  /* ------------------------------------------------------- подсказки ------ */

  // enabled по `open`, а не по фокусу: список открывается уже наполненным
  const { suggestions } = useAddressSuggestions(address, { enabled: open });
  const nav = useSuggestionNav(suggestions.length, (i) => setAddress(suggestions[i]));
  const navReset = nav.reset;
  const showList = listOpen && suggestions.length > 0;

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
      setListOpen(false);
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
    navReset();
    const prev = document.activeElement;
    // preventScroll: на коротком вьюпорте (1366×768) обычный focus прокручивает
    // скроллящуюся подложку к полю, унося заголовок карточки выше края экрана.
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [open, resetSave, navReset]);

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
      // Скрытые кнопки (пилюля карты на ≥768, контролы под раскрытой картой)
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
    // подсказки прячем: на их месте под полем показывается текст ошибки
    setListOpen(false);
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

  /** Живая область под полем: единственный статус — ошибка сохранения. */
  const status = save.isError ? errorText(save.error.message) : '';

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
        className="anim-modal-scrim fixed inset-0 z-50 flex justify-center overflow-y-auto bg-scrim xl:p-4 xl:py-10"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          ref={containerRef}
          // xl:items-center на подложке нельзя: карточка выше вьюпорта (832
          // против 720 на ноутбуках 1366×768) обрезалась бы сверху и
          // доскроллить до заголовка было бы нельзя. Авто-маржины на самой
          // карточке центрируют, когда она влезает, и честно скроллятся,
          // когда нет.
          className="anim-modal-card relative flex w-full xl:my-auto xl:max-w-[952px]"
        >
          {/* ≤1024 крестик внутри правого верхнего угла листа, 1920 — снаружи */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="absolute right-0 top-0 z-30 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface2-hover xl:-right-[60px] xl:top-3.5"
          >
            <Icon name="close" size={20} />
          </button>

          {/* рамка 1px #333333 стоит у карточки на всех адаптивах (1355:102553,
                1395:104269, 1395:106025, 1395:104750), скругление — только на 1920 */}
          <div className="flex min-h-[100dvh] w-full flex-col gap-9 border border-stroke-surface1 bg-surface-page-surf1 p-4 pt-11 md:justify-center md:p-10 xl:min-h-0 xl:rounded-[20px]">
            {/* до 768 шаг карточки 36, а внутри «заголовок ↔ поле» — 20 */}
            <div
              className={clsx('-mb-4 flex flex-col gap-1 md:mb-0', expanded && 'hidden xl:flex')}
            >
              <h2
                id={titleId}
                className="text-2xl font-medium leading-[1.2] text-text-default md:text-[32px]"
              >
                {t('title')}
              </h2>
              <p className="text-sm leading-[1.1] text-text-default md:text-base md:leading-[1.24]">
                {t('subtitle')}
              </p>
            </div>

            {/* ≤768 поле и «Сохранить» — прямые дети листа (contents), поэтому
                  кнопка уезжает к нижнему краю (main:between макета) */}
            <div className="contents md:flex md:items-start md:gap-2">
              <div
                className={clsx(
                  'relative order-2 md:order-none md:flex-1',
                  expanded && 'hidden xl:block',
                )}
              >
                {/* Обёртка ровно по полю: панель подсказок в макете стоит
                      в 4px под ним (1347:80044 @0,58 при поле 54) */}
                <div className="relative">
                  <div
                    className={clsx(
                      'flex h-[54px] items-center rounded-[20px] border border-surface-page-surf3 pl-4 transition-colors',
                      // «Input» с раскрытым списком: правый отступ 24 (1347:80043)
                      showList ? 'pr-6' : 'pr-4',
                      // hover — заливка #333333 и обводка #616161 (885:33285)
                      '[&:hover:not(:focus-within)]:border-stroke-input-hover [&:hover:not(:focus-within)]:bg-surface-page-surf2',
                      // фокус — обводка #EEEEEE (885:33279), в токенах это text/default
                      'focus-within:border-text-default',
                    )}
                  >
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
                        setListOpen(true);
                        navReset();
                      }}
                      // список раскрывает только явное действие пользователя:
                      // клик по полю, ввод или ↓, но не автофокус при открытии
                      onPointerDown={() => setListOpen(true)}
                      onBlur={() => {
                        setListOpen(false);
                        navReset();
                      }}
                      onKeyDown={(e) => {
                        if (!listOpen && e.key === 'ArrowDown' && suggestions.length > 0) {
                          e.preventDefault();
                          setListOpen(true);
                          return;
                        }
                        if (nav.onKeyDown(e)) return;
                        if (e.key === 'Escape' && showList) {
                          // гасим событие, иначе document-обработчик закроет модалку
                          e.preventDefault();
                          setListOpen(false);
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
                      // кольцо :focus-visible здесь лишнее: фокус показывает
                      // сама обводка поля (#EEEEEE), а в макете второй рамки
                      // нет; глобальное правило объявлено вне слоёв
                      className="w-full bg-transparent text-base font-semibold leading-5 text-text-default outline-none placeholder:text-text-disabled focus-visible:outline-none!"
                    />
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
                </div>

                {/* Живая область вынесена из потока: в макете строка
                      «поле + Сохранить» ровно 54px, лишние 20px ломали
                      высоту карточки и её вертикальные отступы */}
                <p
                  aria-live="polite"
                  className="absolute left-0 top-full mt-1 pl-1 text-sm text-text-negative"
                >
                  {status}
                </p>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={save.isPending}
                className={clsx(
                  'order-4 mt-auto inline-flex h-[54px] w-full shrink-0 cursor-pointer items-center justify-center rounded-[20px] bg-btn-brand px-6 text-sm font-medium text-text-always-white transition-[filter] hover:brightness-110 disabled:opacity-60 md:order-none md:mt-0 md:w-[121px]',
                  expanded && 'hidden xl:inline-flex',
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
                // высоты по адаптивам макета: 768 и 1024 → 498, 1920 → 548
                expanded
                  ? 'absolute inset-0 z-20 xl:relative xl:inset-auto xl:z-auto xl:h-[548px] xl:rounded-[20px]'
                  : 'relative order-3 min-h-[220px] flex-1 rounded-[20px] md:h-[498px] md:min-h-0 md:flex-none xl:h-[548px]',
              )}
            >
              <BranchMap
                markers={markers}
                center={center}
                onMarkerClick={(id) => {
                  // клик по пину — тоже выбор адреса, не только ввод руками
                  const point = points.find((p) => p.depId === id);
                  if (!point) return;
                  setAddress(point.address);
                  setDirty(true);
                  setListOpen(false);
                }}
                label={t('mapAlt')}
                // пока отделения грузятся, «не найдены» было бы неправдой
                emptyText={pointsLoading ? t('mapLoading') : t('mapEmpty')}
                className="h-full w-full"
              />

              {/* «a-button-main» 1404:105566 / 1395:106036: 242×38, r20,
                    padding 8/24/8/16, fill #F5F3F2, 16 от нижнего края карты.
                    На 1920 карта нарисована без пилюли, поэтому xl:hidden.
                    Пилюля всегда светлая, поэтому подпись всегда тёмная. */}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="absolute bottom-4 left-1/2 z-10 inline-flex h-[38px] w-[242px] -translate-x-1/2 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[20px] bg-btn-always-white pl-4 pr-6 text-sm font-medium text-[#1A1A1A] shadow-[0_2px_8px_rgb(0_0_0/0.25)] transition-opacity hover:opacity-90 xl:hidden"
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
