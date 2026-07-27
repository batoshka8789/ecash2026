'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { BranchMap, type BranchMapMarker } from '@/components/ui/BranchMap';
import {
  SuggestionList,
  useAddressSuggestions,
  useSuggestionNav,
} from '@/components/layout/AddressDropdown';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatBranchAddress } from '@/lib/branch-address';
import { useBranchPoints, useGeolocate } from '@/lib/branch-points';
import { useErrorText } from '@/lib/useErrorText';

/** Вкладка «Мой адрес»: поле адреса с автокомплитом по адресам отделений
 *  + карта, сохранение в наш слой профиля. */
export function AddressCard() {
  const t = useTranslations('profile.address');
  const { account, invalidate } = useAuth();
  const errorText = useErrorText();
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [address, setAddress] = useState('');
  const [focused, setFocused] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // подсказки — те же честные адреса отделений, что и в шапке
  const { suggestions } = useAddressSuggestions(address, { enabled: focused });
  const nav = useSuggestionNav(suggestions.length, (i) => setAddress(suggestions[i]));
  const showList = focused && suggestions.length > 0;

  // Та же интерактивная карта и та же выборка отделений, что на /locations
  // и в модалке адреса, — «покажем ближайшие обменники» должно быть правдой.
  const { points, loading: pointsLoading } = useBranchPoints();

  // Введённый адрес совпал с отделением — подсвечиваем пин и центрируем карту.
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
    setFocused(false);
  });
  const geoReset = geo.reset;

  // синхронизация из сессии во время рендера
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  if (account && syncedFor !== account.accountId) {
    setSyncedFor(account.accountId);
    setAddress(account.profile.address);
  }

  const save = useMutation({
    mutationFn: (value: string) => api.profile.save({ address: value }),
    onSuccess: async () => {
      await invalidate();
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    },
  });

  // старый баг: setTimeout переживал размонтирование — чистим при уходе
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  /** Одна живая область: ошибка сохранения важнее статуса геолокации. */
  const status = save.error
    ? errorText(save.error.message)
    : geo.status === 'pending'
      ? t('locating')
      : geo.status === 'denied'
        ? t('locateDenied')
        : geo.status === 'unsupported' || geo.status === 'empty'
          ? t('locateEmpty')
          : '';

  return (
    <div className="rounded-[20px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:p-10">
      <h2 className="text-2xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
        {t('title')}
      </h2>
      <p className="mt-1 text-base leading-[1.24] text-text-default">{t('subtitle')}</p>

      <div className="mt-9 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <div className="flex items-center rounded-[20px] border border-stroke-surface3 transition-colors focus-within:border-stroke-brand">
            <label htmlFor={inputId} className="sr-only">
              {t('placeholder')}
            </label>
            <input
              id={inputId}
              ref={inputRef}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                nav.reset();
                geoReset();
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                nav.reset();
              }}
              onKeyDown={(e) => {
                if (nav.onKeyDown(e)) return;
                if (e.key === 'Escape') setFocused(false);
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
              className="h-[54px] w-full bg-transparent px-4 text-base font-semibold leading-5 text-text-default outline-none placeholder:font-medium placeholder:text-text-disabled"
            />
            {address && (
              <button
                type="button"
                onClick={() => {
                  setAddress('');
                  nav.reset();
                  inputRef.current?.focus();
                }}
                aria-label={t('clear')}
                className="cursor-pointer px-3 text-text-disabled transition-colors hover:text-text-default"
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
                nav.reset();
              }}
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-[20px] border border-stroke-modal bg-surface-modal-bg p-2 shadow-[0_0_6px_rgb(0_0_0/0.12)]"
            />
          )}
        </div>
        <Button
          onClick={() => save.mutate(address)}
          disabled={save.isPending}
          className="h-[54px] rounded-[20px] text-sm sm:w-[121px]"
        >
          {saved ? t('saved') : t('save')}
        </Button>
      </div>

      <div aria-live="polite">
        {status && <p className="mt-3 text-sm text-text-negative">{status}</p>}
        <span className="sr-only">{saved ? t('saved') : ''}</span>
      </div>

      <div className="relative mt-9 overflow-hidden rounded-[20px]">
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
            setFocused(false);
            geoReset();
          }}
          label={t('title')}
          // пока отделения грузятся, «не найдены» было бы неправдой
          emptyText={pointsLoading ? t('mapLoading') : t('mapEmpty')}
          className="h-64 sm:h-96 xl:h-[477px]"
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
      </div>
    </div>
  );
}
