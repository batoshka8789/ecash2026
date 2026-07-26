'use client';

import { useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currencyFlagClass, currencyName, currencySymbol, formatNumber } from '@/lib/format';
import { useErrorText } from '@/lib/useErrorText';
import type { Competitor, CurrencyCode, RateStat } from '@/lib/domain';

const DEP_ID = 1;
/** Общий ключ с Calculator — TanStack Query дедуплицирует запрос. */
const ratesQueryKey = ['rates', DEP_ID] as const;

/** Валюты «первого экрана» до нажатия «Показать все валюты». */
const PRIMARY_CODES: readonly CurrencyCode[] = ['USD', 'EUR', 'RUB', 'CNY', 'GOLD1'];

type RatesResponse = Awaited<ReturnType<typeof api.rates.forDep>>;

/** Блок «Курсы валют»: живые курсы отделения, избранное и конкуренты из BFF. */
export function RatesList() {
  const t = useTranslations('home.rates');
  const tRoot = useTranslations();
  const errorText = useErrorText();
  const { authed } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const listId = useId();

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ratesQueryKey,
    queryFn: ({ signal }) => api.rates.forDep(DEP_ID, signal),
  });

  const qc = useQueryClient();
  const favMutation = useMutation({
    mutationFn: (code: CurrencyCode) => api.toggleFavorite(code),
    onMutate: async (code) => {
      // оптимистично — закладка отзывается мгновенно
      await qc.cancelQueries({ queryKey: ratesQueryKey });
      const prev = qc.getQueryData<RatesResponse>(ratesQueryKey);
      qc.setQueryData<RatesResponse>(ratesQueryKey, (cur) =>
        cur
          ? {
              ...cur,
              favorites: cur.favorites.includes(code)
                ? cur.favorites.filter((c) => c !== code)
                : [...cur.favorites, code],
            }
          : cur,
      );
      return { prev };
    },
    // откат к прежнему списку; 401 и прочие ошибки — молча, без сломанного UI
    onError: (_err, _code, ctx) => {
      if (ctx?.prev) qc.setQueryData(ratesQueryKey, ctx.prev);
    },
    onSuccess: (res) => {
      qc.setQueryData<RatesResponse>(ratesQueryKey, (cur) =>
        cur ? { ...cur, favorites: res.favorites } : cur,
      );
    },
  });

  // KZT приходит с нулевыми курсами — в списке ему не место
  const { list, hasMore } = useMemo(() => {
    const all = (data?.rates ?? []).filter((r) => r.currencyCode !== 'KZT');
    const byCode = new Map(all.map((r) => [r.currencyCode, r]));
    const pinned: RateStat[] = [];
    const seen = new Set<string>();
    // избранные — первыми, затем основной набор; дубликаты не показываем
    for (const code of [...(data?.favorites ?? []), ...PRIMARY_CODES]) {
      const stat = byCode.get(code);
      if (stat && !seen.has(code)) {
        seen.add(code);
        pinned.push(stat);
      }
    }
    const rest = all.filter((r) => !seen.has(r.currencyCode));
    return { list: showAll ? [...pinned, ...rest] : pinned, hasMore: rest.length > 0 };
  }, [data, showAll]);

  return (
    <section className="container-page pt-6 sm:pt-8">
      <div className="rounded-2xl border border-stroke-surface1 bg-surface-page-surf1 p-5 sm:rounded-[28px] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium text-text-default sm:text-[32px]">{t('title')}</h2>
          {/* Единственная точка входа на /locations с главной — в макете
              этого перехода нет ни на одном фрейме, но без него страница
              со списком/картой отделений недостижима из приложения вообще. */}
          <Link
            href="/locations"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-text-brand transition-colors hover:bg-comp-surface1-hover sm:h-10 sm:px-4"
          >
            <Icon name="location_on" size={18} />
            {t('allBranches')}
          </Link>
        </div>

        {isPending && (
          <div className="mt-5 flex flex-col gap-1 sm:mt-10" role="status">
            <span className="sr-only">{tRoot('system.loading')}</span>
            {PRIMARY_CODES.map((code) => (
              <div
                key={code}
                aria-hidden
                className="h-[104px] rounded-2xl bg-surface-page-surf2 motion-safe:animate-pulse sm:h-28"
              />
            ))}
          </div>
        )}

        {isError && (
          <div
            role="alert"
            className="mt-5 flex flex-col items-center gap-4 rounded-2xl bg-surface-page-surf2 px-5 py-10 text-center sm:mt-6"
          >
            <p className="text-base text-text-default">
              {errorText(error instanceof Error ? error.message : undefined)}
            </p>
            <Button variant="surf2" size="md" disabled={isRefetching} onClick={() => refetch()}>
              {tRoot('branches.retry')}
            </Button>
          </div>
        )}

        {data && (
          <>
            <div id={listId} className="mt-5 flex flex-col gap-1 sm:mt-10">
              {list.map((stat, i) => (
                <div key={stat.currencyCode} className="anim-row-in">
                  <RateRow
                    stat={stat}
                    competitors={data.competitors}
                    marketRate={data.marketRates?.[stat.currencyCode] ?? null}
                    favorite={data.favorites.includes(stat.currencyCode)}
                    showBookmark={authed}
                    onToggleFavorite={() => favMutation.mutate(stat.currencyCode)}
                    defaultOpen={i === 0}
                  />
                </div>
              ))}
            </div>

            {(hasMore || showAll) && (
              // «a-button-main» на surf1: обводка в цвет фона, брендовая подпись
              <button
                type="button"
                aria-expanded={showAll}
                aria-controls={listId}
                onClick={() => setShowAll((v) => !v)}
                className="mx-auto mt-3 flex h-[46px] cursor-pointer items-center gap-2 rounded-[20px] border border-stroke-surface1 bg-surface-page-surf1 pl-6 pr-4 text-sm font-medium text-text-brand transition-colors hover:bg-comp-surface1-hover sm:mt-4"
              >
                {showAll ? t('hideAll') : t('showAll')}
                <motion.span
                  animate={{ rotate: showAll ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex"
                >
                  <Icon name="keyboard_arrow_down" size={20} />
                </motion.span>
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function RateRow({
  stat,
  competitors,
  marketRate,
  favorite,
  showBookmark,
  onToggleFavorite,
  defaultOpen,
}: {
  stat: RateStat;
  competitors: Competitor[];
  /** биржевой курс НБ РК — приходит только для строки USD */
  marketRate: number | null;
  favorite: boolean;
  showBookmark: boolean;
  onToggleFavorite: () => void;
  defaultOpen?: boolean;
}) {
  const t = useTranslations('home.rates');
  const tRates = useTranslations('rates');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const panelId = useId();

  const code = stat.currencyCode;
  const flag = code.startsWith('GOLD') ? 'gold' : currencyFlagClass(code);
  // локализованное имя вместо русского названия из API
  const name = currencyName(code, locale, (grams) => tRates('gold', { grams }));

  return (
    <div
      className={clsx(
        // «Component 14»: r20 на surf2, паддинги 24/24/12/24
        'rounded-[20px] border bg-surface-page-surf2 px-4 pb-3 pt-4 transition-colors sm:px-6 sm:pt-6',
        open ? 'border-stroke-surface2' : 'border-transparent',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 sm:flex-nowrap sm:gap-4">
        {showBookmark && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={`${t('bookmark')} — ${name}`}
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
        )}

        {flag ? (
          <CurrencyFlag flag={flag} className="h-7 w-10 shrink-0 sm:h-8 sm:w-11" />
        ) : (
          <span
            aria-hidden
            className="flex h-7 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-modal-surf1 text-[10px] font-bold text-text-disabled sm:h-8 sm:w-11"
          >
            {code.slice(0, 3)}
          </span>
        )}

        <div className="min-w-0 sm:min-w-24">
          <div className="text-lg font-medium text-text-default sm:text-xl">{code}</div>
          <div className="truncate text-[11px] font-medium text-text-disabled sm:text-xs">
            {name}
          </div>
        </div>

        <div className="ml-auto grid shrink-0 grid-cols-2 gap-6 text-center sm:gap-10">
          <div>
            <div className="text-[11px] text-text-disabled sm:text-sm">{t('buy')}</div>
            <div className="text-base text-text-default sm:text-lg">
              {formatNumber(stat.buy, locale, 2)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-text-disabled sm:text-sm">{t('sell')}</div>
            <div className="text-base text-text-default sm:text-lg">
              {formatNumber(stat.sell, locale, 2)}
            </div>
          </div>
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
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
        {marketRate !== null ? (
          <div className="flex items-center gap-2 text-xs text-text-disabled sm:gap-3 sm:text-sm">
            {t('exchangeRate')}
            <span className="rounded-xl bg-surface-modal-surf1 px-3 py-1 font-medium text-text-default">
              {tRates('perUnit', {
                rate: formatNumber(marketRate, locale, 2),
                code: currencySymbol(code),
              })}
            </span>
          </div>
        ) : (
          <span aria-hidden />
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex cursor-pointer items-center gap-1 text-xs text-text-disabled transition-colors hover:text-text-default sm:text-sm"
        >
          {open ? t('collapse') : t('compare')}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex"
          >
            <Icon name="keyboard_arrow_down" size={18} />
          </motion.span>
        </button>
      </div>

      {open && (
        <div id={panelId} className="anim-panel-in overflow-hidden">
          {/* «Rectangle 555» — разделитель цветом divider-hole, затем строки конкурентов */}
          <div className="mt-4 border-t border-divider-hole pt-4 sm:mt-8">
            <div className="flex flex-col gap-4 sm:gap-6">
              {competitors.map((comp) => (
                <div key={comp.id} className="flex items-center gap-3 sm:gap-4">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-11 shrink-0 items-center justify-center rounded-xl border bg-surface-modal-surf1 sm:h-10 sm:w-12"
                    style={{ borderColor: comp.color }}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: comp.color }} />
                  </span>
                  <span className="min-w-0 truncate text-sm text-text-disabled sm:text-base">
                    {t(`competitors.${comp.nameKey}`)}
                  </span>
                  <div className="ml-auto grid shrink-0 grid-cols-2 gap-6 text-center sm:gap-10">
                    <span className="w-16 text-base text-text-default sm:w-20">
                      {formatNumber(comp.buy, locale, 2)}
                    </span>
                    <span className="w-16 text-base text-text-default sm:w-20">
                      {formatNumber(comp.sell, locale, 2)}
                    </span>
                  </div>
                  <span className="hidden sm:block sm:min-w-40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
