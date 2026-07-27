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
    <section className="container-page bleed-mobile pt-3 sm:pt-6">
      <div className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
            {t('title')}
          </h2>
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
          <div className="mt-6 flex flex-col gap-1 sm:mt-10" role="status">
            <span className="sr-only">{tRoot('system.loading')}</span>
            {PRIMARY_CODES.map((code) => (
              <div
                key={code}
                aria-hidden
                className="h-[245px] rounded-[20px] bg-surface-page-surf2 motion-safe:animate-pulse sm:h-[122px]"
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
            <div id={listId} className="mt-6 flex flex-col gap-1 sm:mt-10">
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
                className="mx-auto mt-3 flex h-[46px] cursor-pointer items-center gap-2 rounded-[20px] border border-surface-page-surf1 bg-surface-page-surf1 pl-6 pr-4 text-sm font-medium text-text-brand transition-colors hover:bg-comp-surface1-hover"
              >
                {showAll ? t('hideAll') : t('showAll')}
                <motion.span
                  animate={{ rotate: showAll ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex"
                >
                  <Icon name="arrow_drop_down" size={20} />
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
        // «Component 14»/«Component 21»: r20 на surf2, БЕЗ обводки в макете;
        // паддинги 24/24/12/24 закрыт, 24 со всех сторон открыт
        'rounded-[20px] bg-surface-page-surf2 px-4 pb-3 pt-4 transition-colors sm:px-6 sm:pt-6',
        open && 'pb-4 sm:pb-6',
      )}
    >
      {/* 360/480 — три строки, 768 — курсы в шапке и кнопки отдельно, 1024+ — одна строка */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-6 lg:flex-nowrap lg:gap-3">
        {showBookmark && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={`${t('bookmark')} — ${name}`}
            aria-pressed={favorite}
            className={clsx(
              // в макете между закладкой и флагом 24 — 12 от gap строки плюс этот отступ
              'mr-3 cursor-pointer transition-colors',
              favorite ? 'text-brand' : 'text-text-disabled hover:text-text-default',
            )}
          >
            <motion.span whileTap={{ scale: 0.8 }} className="flex">
              <Icon name="bookmark" size={24} filled={favorite} />
            </motion.span>
          </button>
        )}

        {flag ? (
          <CurrencyFlag flag={flag} className="h-10 w-[50px] shrink-0" />
        ) : (
          <span
            aria-hidden
            className="flex h-10 w-[50px] shrink-0 items-center justify-center rounded-lg bg-surface-modal-surf1 text-[10px] font-bold text-text-disabled"
          >
            {code.slice(0, 3)}
          </span>
        )}

        <div className="min-w-0 sm:min-w-24">
          <div className="text-xl font-medium text-text-default">{code}</div>
          <div className="truncate text-xs font-medium text-text-disabled">{name}</div>
        </div>

        {/* колонки 114px — в макете они выровнены с колонками строк конкурентов */}
        <div className="grid w-full shrink-0 grid-cols-[auto_auto] justify-start gap-6 text-center sm:ml-auto sm:w-auto sm:gap-10">
          <div className="flex flex-col gap-1 sm:w-[114px]">
            <div className="text-sm text-text-disabled">{t('buy')}</div>
            <div className="text-lg text-text-default lg:text-xl">
              {formatNumber(stat.buy, locale, 2)}
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:w-[114px]">
            <div className="text-sm text-text-disabled">{t('sell')}</div>
            <div className="text-lg text-text-default lg:text-xl">
              {formatNumber(stat.sell, locale, 2)}
            </div>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 lg:w-auto">
          {/* «list-map» из макета — своей иконки под комбо документ+карта в
              Material Symbols нет, ближайший по смыслу — map (тот же, что и
              на переключателе Списком/На карте). Ведёт туда же, куда и общая
              ссылка «Все отделения» — своего параметра под конкретную
              валюту в /locations нет. */}
          <Link
            href="/locations"
            aria-label={t('showOnMap')}
            title={t('showOnMap')}
            className="inline-flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-divider-elevated text-text-default transition-colors hover:bg-comp-surface1-hover"
          >
            <Icon name="map" size={28} />
          </Link>
          {/* «!» у радиуса: size кнопки приносит rounded-full, в макете 20 */}
          <Button
            size="md"
            className="h-[46px] flex-1 px-6 sm:min-w-[134px]"
            onClick={() => router.push('/booking')}
          >
            {t('book')}
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {marketRate !== null ? (
          <div className="flex items-center gap-3 text-sm text-text-disabled sm:pl-12">
            {t('exchangeRate')}
            <span className="rounded-xl bg-surface-modal-surf1 px-3 py-1 text-text-disabled">
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
          className="ml-auto flex cursor-pointer items-center gap-2 text-sm font-medium text-text-disabled transition-colors hover:text-text-default"
        >
          {open ? t('collapse') : t('compare')}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex"
          >
            <Icon name="arrow_drop_down" size={20} />
          </motion.span>
        </button>
      </div>

      {open && (
        <div id={panelId} className="anim-panel-in overflow-hidden">
          {/* «Rectangle 555» — разделитель цветом divider-hole, затем строки конкурентов */}
          <div className="mt-8 border-t border-divider-hole pt-8">
            <div className="flex flex-col gap-6">
              {competitors.map((comp) => (
                <div
                  key={comp.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:flex-nowrap sm:gap-4"
                >
                  {/* «logo»: 50×42 r14 на modal-surf1, обводка цветом конкурента, глиф вместо точки */}
                  <span
                    aria-hidden
                    className="inline-flex h-[42px] w-[50px] shrink-0 items-center justify-center rounded-[14px] border bg-surface-modal-surf1"
                    style={{ borderColor: comp.color }}
                  >
                    <Icon name="location_on" size={24} className="text-text-default" />
                  </span>
                  <span className="min-w-0 truncate text-base text-text-disabled">
                    {t(`competitors.${comp.nameKey}`)}
                  </span>
                  <div className="grid w-full shrink-0 grid-cols-[auto_auto] justify-start gap-4 text-center sm:ml-auto sm:w-auto sm:gap-10">
                    <span className="w-16 text-base text-text-default sm:w-[114px]">
                      {formatNumber(comp.buy, locale, 2)}
                    </span>
                    <span className="w-16 text-base text-text-default sm:w-[114px]">
                      {formatNumber(comp.sell, locale, 2)}
                    </span>
                  </div>
                  {/* «отбивка» под блок кнопок строки курса — с 1024 колонки должны совпасть */}
                  <span className="hidden lg:block lg:w-[184px]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
