'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/useApi';
import type { Competitor, Currency } from '@/lib/types';

/** Блок «Курсы валют»: данные и избранное берутся из мок-бэкенда. */
export function RatesList() {
  const t = useTranslations('home.rates');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => api.rates(), []);
  const { data, setData } = useQuery(load);

  const toggleFavorite = async (code: Currency['code']) => {
    // оптимистично — чтобы закладка отзывалась мгновенно
    setData((prev) =>
      prev
        ? {
            ...prev,
            favorites: prev.favorites.includes(code)
              ? prev.favorites.filter((c) => c !== code)
              : [...prev.favorites, code],
          }
        : prev,
    );
    const res = await api.toggleFavorite(code).catch(() => null);
    if (res) setData((prev) => (prev ? { ...prev, favorites: res.favorites } : prev));
  };

  const list = (data?.currencies ?? []).filter((c) => c.primary || showAll);

  return (
    <section className="container-page pt-6 sm:pt-8">
      <div className="rounded-2xl border border-stroke-surface1 bg-surface-page-surf1 p-5 sm:rounded-[28px] sm:p-8">
        <h2 className="text-xl font-bold text-text-default sm:text-[28px]">{t('title')}</h2>

        <div className="mt-5 flex flex-col gap-3 sm:mt-6">
          <AnimatePresence initial={false}>
            {list.map((c, i) => (
              <motion.div
                key={c.code}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <RateRow
                  currency={c}
                  competitors={data?.competitors ?? []}
                  marketRate={data?.marketRate ?? 0}
                  favorite={data?.favorites.includes(c.code) ?? false}
                  onToggleFavorite={() => toggleFavorite(c.code)}
                  defaultOpen={i === 0}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mx-auto mt-5 flex cursor-pointer items-center gap-1 text-sm font-medium text-text-brand transition-opacity hover:opacity-80 sm:mt-6 sm:text-base"
        >
          {showAll ? t('hideAll') : t('showAll')}
          <motion.span animate={{ rotate: showAll ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex">
            <Icon name="keyboard_arrow_down" size={22} />
          </motion.span>
        </button>
      </div>
    </section>
  );
}

function RateRow({
  currency,
  competitors,
  marketRate,
  favorite,
  onToggleFavorite,
  defaultOpen,
}: {
  currency: Currency;
  competitors: Competitor[];
  marketRate: number;
  favorite: boolean;
  onToggleFavorite: () => void;
  defaultOpen?: boolean;
}) {
  const t = useTranslations('home.rates');
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultOpen));

  const marketLabel = `${marketRate.toString().replace('.', ',')} ₸ = 1 $`;

  return (
    <div
      className={clsx(
        'rounded-2xl border bg-surface-page-surf2 px-4 py-4 transition-colors sm:px-5',
        open ? 'border-stroke-surface2' : 'border-transparent',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 sm:flex-nowrap sm:gap-4">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={t('bookmark')}
          aria-pressed={favorite}
          className={clsx(
            'cursor-pointer transition-colors',
            favorite ? 'text-brand' : 'text-text-disabled hover:text-text-default',
          )}
        >
          <motion.span whileTap={{ scale: 0.8 }} className="flex">
            <Icon name="bookmark" size={22} filled={favorite} />
          </motion.span>
        </button>

        <CurrencyFlag flag={currency.flag} className="h-7 w-10 shrink-0 sm:h-8 sm:w-11" />

        <div className="min-w-0 sm:min-w-24">
          <div className="text-base font-bold text-text-default sm:text-lg">{currency.code}</div>
          <div className="text-[11px] text-text-disabled sm:text-xs">
            {t(`currencies.${currency.nameKey}`)}
          </div>
        </div>

        <div className="ml-auto grid shrink-0 grid-cols-2 gap-6 text-center sm:gap-10">
          <div>
            <div className="text-[11px] text-text-disabled sm:text-sm">{t('buy')}</div>
            <div className="text-base font-medium text-text-default sm:text-lg">{currency.buy}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-disabled sm:text-sm">{t('sell')}</div>
            <div className="text-base font-medium text-text-default sm:text-lg">{currency.sell}</div>
          </div>
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <button
            type="button"
            aria-label={t('compareIcon')}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-surface-modal-surf1 text-text-default transition-colors hover:bg-comp-surface2-hover sm:h-12 sm:w-12"
          >
            <Icon name="currency_exchange" size={20} />
          </button>
          <Button
            size="md"
            className="h-11 flex-1 sm:h-12 sm:min-w-40"
            onClick={() => router.push('/booking')}
          >
            {t('book')}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-text-disabled sm:gap-3 sm:text-sm">
          {t('exchangeRate')}
          <span className="rounded-full bg-brand-hardsoft px-3 py-1 font-medium text-text-brand">
            {marketLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-1 text-xs text-text-disabled transition-colors hover:text-text-default sm:text-sm"
        >
          {open ? t('collapse') : t('compare')}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex">
            <Icon name="keyboard_arrow_down" size={18} />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-divider-additional pt-2">
              {competitors.map((comp) => (
                <div
                  key={comp.id}
                  className="flex items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-comp-surface2-hover sm:gap-4 sm:px-2"
                >
                  <span
                    className="inline-flex h-9 w-11 shrink-0 items-center justify-center rounded-xl border bg-surface-modal-surf1 sm:h-10 sm:w-12"
                    style={{ borderColor: comp.color }}
                  >
                    <Icon name="visibility_off" size={18} className="text-text-disabled" />
                  </span>
                  <span className="min-w-0 truncate text-sm text-text-disabled sm:text-base">
                    {t(`competitors.${comp.nameKey}`)}
                  </span>
                  <div className="ml-auto grid shrink-0 grid-cols-2 gap-6 text-center sm:gap-10">
                    <span className="w-16 text-base text-text-default sm:w-20 sm:text-lg">{comp.buy}</span>
                    <span className="w-16 text-base text-text-default sm:w-20 sm:text-lg">{comp.sell}</span>
                  </div>
                  <span className="hidden sm:block sm:w-12" />
                  <span className="hidden sm:block sm:min-w-40" />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
