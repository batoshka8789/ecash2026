'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/useApi';

const badgeStyles = {
  best: 'bg-brand text-text-always-white',
  happyHours: 'bg-additional-2 text-text-always-white',
  nearest: 'bg-additional-3 text-text-always-white',
} as const;

/** Блок «Отделения Ecash»: переключатель Списком / На карте. */
export function Branches() {
  const t = useTranslations('locations');
  const [view, setView] = useState<'list' | 'map'>('list');
  const { data } = useQuery(useCallback(() => api.branches('distance'), []));
  const branches = data?.branches ?? [];

  return (
    <section className="container-page pt-8">
      <div className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold sm:text-[28px] text-text-default">{t('title')}</h2>
          <div className="flex rounded-full bg-surface-page-bg p-1">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={clsx(
                  'flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                  view === v
                    ? 'border border-stroke-surface2 bg-surface-page-surf2 text-text-default'
                    : 'text-text-default',
                )}
              >
                <Icon name={v === 'list' ? 'list_alt' : 'map'} size={18} />
                {t(v === 'list' ? 'asList' : 'onMap')}
              </button>
            ))}
          </div>
        </div>

        {view === 'list' ? (
          <div className="mt-4 divide-y divide-divider-additional">
            {branches.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-4 py-5">
                <div className="min-w-52">
                  {b.badges.length > 0 && (
                    <div className="mb-1.5 flex gap-1.5">
                      {b.badges.map((badge) => (
                        <span
                          key={badge}
                          className={clsx(
                            'rounded-md px-2 py-0.5 text-[11px] font-medium',
                            badgeStyles[badge],
                          )}
                        >
                          {t(`badges.${badge}`)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-base text-text-default">
                    <Icon name="account_balance" size={18} className="text-text-disabled" />
                    {b.address}
                    <span className="text-text-disabled">• {b.distanceKm} {t('km')}</span>
                    <button
                      type="button"
                      aria-label={t('copy')}
                      className="cursor-pointer text-text-disabled transition-colors hover:text-text-default"
                    >
                      <Icon name="content_copy" size={16} />
                    </button>
                  </div>
                </div>

                <div className="ml-auto grid grid-cols-2 gap-10 text-center">
                  <div>
                    <div className="text-sm text-text-disabled">{t('buyUsd')}</div>
                    <div className="text-lg font-medium text-text-default">{b.buy}</div>
                  </div>
                  <div>
                    <div className="text-sm text-text-disabled">{t('sellUsd')}</div>
                    <div className="text-lg font-medium text-text-default">{b.sell}</div>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={t('showOnMap')}
                  onClick={() => setView('map')}
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf2 text-text-default transition-colors hover:bg-comp-surface2-hover"
                >
                  <Icon name="location_on" size={20} filled />
                </button>
                <Button variant="brand-outline" size="md" className="min-w-40">
                  {t('book')}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative mt-6 overflow-hidden rounded-2xl">
            <img src="/img/map-dark.png" alt="" className="h-[520px] w-full object-cover" />
            <button
              type="button"
              className="absolute bottom-4 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-toast px-4 py-2.5 text-sm text-text-default shadow-md transition-colors hover:bg-comp-surface2-hover"
            >
              <Icon name="open_in_full" size={16} />
              {t('fullscreen')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
