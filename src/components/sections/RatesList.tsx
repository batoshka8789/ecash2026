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

/**
 * Типографика строк конкурентов: до 1024 в макете Roboto Regular 16/1.24,
 * с 1024 — SF Pro Semibold 17/22 с трекингом −0.43 (font-system: свободно
 * распространять SF Pro нельзя, а system-ui на Apple и есть он).
 */
const competitorText =
  'text-base leading-[1.24] lg:font-system lg:text-[17px] lg:font-semibold lg:leading-[22px] lg:tracking-[-0.43px]';

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
      {/* боковые поля карточки в макете: 4 на 360, 16 на 480, 32 с 768 */}
      <div className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 px-1 py-4 min-[480px]:p-4 md:p-8">
        {/* на 360 у шапки блока свои 12 по бокам («Frame 1437255344») */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 min-[480px]:px-0">
          {/* три ступени кегля из макета: 18 (<480), 24 (480…767), 32 (≥768) */}
          <h2 className="text-[18px] font-medium leading-[1.2] text-text-default min-[480px]:text-[24px] md:text-[32px]">
            {t('title')}
          </h2>
          {/* Единственная точка входа на /locations с главной — в макете
              этого перехода нет ни на одном фрейме, но без него страница
              со списком/картой отделений недостижима из приложения вообще.
              Высоту ссылке не задаём: строку шапки в макете задаёт заголовок
              (21.6 / 28.8 / 38.4), поэтому вертикальные поля ссылки на каждой
              ступени заведомо меньше его высоты и не растягивают строку. */}
          <Link
            href="/locations"
            // на 360 поля гасим отрицательными: тач-зона остаётся 28, а в
            // строку шапки ссылка отдаёт те же 20, что и без паддинга
            className="-my-1 inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1 text-sm font-medium text-text-brand transition-colors hover:bg-comp-surface1-hover min-[480px]:my-0 sm:px-4 md:py-2"
          >
            <Icon name="location_on" size={18} />
            {t('allBranches')}
          </Link>
        </div>

        {isPending && (
          <div className="mt-6 flex flex-col gap-1 md:mt-10" role="status">
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
            <div id={listId} className="mt-6 flex flex-col gap-1 md:mt-10">
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
      <div className="flex flex-wrap items-center gap-y-6 lg:flex-nowrap">
        {showBookmark && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={`${t('bookmark')} — ${name}`}
            aria-pressed={favorite}
            className={clsx(
              // «Frame 1437254881»: между закладкой и флагом 24
              'mr-6 cursor-pointer transition-colors',
              favorite ? 'text-brand' : 'text-text-disabled hover:text-text-default',
            )}
          >
            <motion.span whileTap={{ scale: 0.8 }} className="flex">
              <Icon name="bookmark" size={24} filled={favorite} />
            </motion.span>
          </button>
        )}

        {/* «Frame 1437255195»: флаг 50×40 r10 и пара код/название, зазор 12.
            «!» у радиуса — у самого CurrencyFlag стоит rounded-lg (8). */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {flag ? (
            <CurrencyFlag flag={flag} className="h-10 w-[50px] shrink-0 rounded-[10px]!" />
          ) : (
            <span
              aria-hidden
              className="flex h-10 w-[50px] shrink-0 items-center justify-center rounded-[10px] bg-surface-modal-surf1 text-[10px] font-bold text-text-disabled"
            >
              {code.slice(0, 3)}
            </span>
          )}
          <div className="min-w-0">
            {/* код валюты в макете набран Rubik Medium 20/1.4 */}
            <div className="font-rubik text-xl font-medium leading-[1.4] text-text-default">
              {code}
            </div>
            {/* Intl.DisplayNames отдаёт «доллар США» — в макете с прописной */}
            <div className="truncate text-xs font-medium leading-[1.3] text-text-disabled first-letter:uppercase">
              {name}
            </div>
          </div>
        </div>

        {/* «Frame 1437255355»: колонки 154 (20 + 114 + 20), ниже 640 — по содержимому */}
        <div className="flex w-full shrink-0 text-center sm:ml-auto sm:w-auto">
          <div className="flex flex-col justify-center gap-1 px-3 sm:w-[154px] sm:px-5">
            <div className="text-sm leading-[1.1] text-text-disabled lg:font-inter lg:leading-[1.4]">
              {t('buy')}
            </div>
            <div className="text-lg leading-5 text-text-default">
              {formatNumber(stat.buy, locale, 2)}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-1 px-3 sm:w-[154px] sm:px-5">
            <div className="text-sm leading-[1.1] text-text-disabled lg:font-inter lg:leading-[1.4]">
              {t('sell')}
            </div>
            <div className="text-lg leading-5 text-text-default">
              {formatNumber(stat.sell, locale, 2)}
            </div>
          </div>
        </div>

        {/* «Frame 1437254997» 208×46 с отступом 20 слева; ниже 768 в макете
            оранжевая кнопка идёт первой, а карта — за ней */}
        <div className="flex w-full flex-row-reverse items-center gap-2 md:flex-row lg:w-auto lg:pl-5">
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
          {/* с 1024 кнопка в макете ровно 134×46 при подписи 102 — то есть
              фактические боковые поля 16, а не 24 из размера M */}
          <Button
            size="md"
            className="flex-1 lg:w-[134px] lg:flex-none lg:px-4"
            onClick={() => router.push('/booking')}
          >
            {t('book')}
          </Button>
        </div>
      </div>

      {/* «Frame 1437255007»: подпись с плашкой и пилюля «Сравнить»;
          на 1024/1920 подпись отбита от края строки на 48, пилюля — по краю */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 lg:pl-12">
        {marketRate !== null ? (
          <div className="flex items-center gap-2 text-xs font-medium leading-[1.3] text-text-disabled min-[480px]:gap-3 min-[480px]:text-sm min-[480px]:font-normal min-[480px]:leading-[1.1] lg:font-medium lg:leading-5">
            {t('exchangeRate')}
            {/* цвет текста плашки в макете тот же text-disabled, что и у подписи */}
            <span className="rounded-xl bg-surface-modal-surf1 px-2 py-0.5 font-normal leading-[18px] min-[480px]:px-3 min-[480px]:py-1 min-[480px]:leading-[1.1]">
              {tRates('perUnit', {
                rate: formatNumber(marketRate, locale, 2),
                code: currencySymbol(code),
              })}
            </span>
          </div>
        ) : (
          <span aria-hidden />
        )}
        {/* «a-button-main» 77×32 (короткая подпись) и 169×32 (полная): заливка
            в цвет строки, подпись Roboto Regular 14/1.1 цветом #8C8C8C —
            своего токена под этот серый нет. Ширина у нас выходит больше: в
            макете текстовый слой фиксирован (55×14 и 147×14), и реальная
            строка в него не влезает — настоящий Roboto 14 даёт 63.1 и 171.1. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex h-8 cursor-pointer items-center gap-2 rounded-[20px] bg-surface-page-surf2 text-sm leading-[1.1] font-normal text-[#8C8C8C] transition-colors hover:bg-comp-surface2-hover"
        >
          {/* на 360/480 в макете короткая подпись «Сравнить» (кнопка 77×32),
              с 768 — полная (169×32); переключаем по sm, между 640 и 768
              ступени в макете нет. «Свернуть» везде полная. */}
          {open ? (
            t('collapse')
          ) : (
            <>
              <span className="sm:hidden">{t('compareShort')}</span>
              <span className="hidden sm:inline">{t('compare')}</span>
            </>
          )}
          {/* слот стрелки в макете 12×12 («Icon wrapper» 847:36891); вложенные
              20×20 — это габарит плейсхолдера-заглушки, а не самой иконки.
              Цвет у стрелки свой: вектор #EEEEEE при подписи #8C8C8C */}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex text-text-default"
          >
            <Icon name="arrow_drop_down" size={12} />
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
                  className="flex flex-wrap items-center gap-y-3 sm:flex-nowrap lg:pl-12"
                >
                  {/* «Frame 1437254881»: логотип 50×42 r14 и название, зазор 16.
                      Ниже 640 занимает всю строку — колонки уходят под неё */}
                  <div className="flex min-w-0 basis-full items-center gap-4 sm:basis-0 sm:grow">
                    {/* «logo»: на modal-surf1, обводка цветом конкурента, глиф вместо точки */}
                    <span
                      aria-hidden
                      className="inline-flex h-[42px] w-[50px] shrink-0 items-center justify-center rounded-[14px] border bg-surface-modal-surf1"
                      style={{ borderColor: comp.color }}
                    >
                      <Icon name="location_on" size={24} className="text-text-default" />
                    </span>
                    <span className={clsx('min-w-0 truncate text-text-disabled', competitorText)}>
                      {t(`competitors.${comp.nameKey}`)}
                    </span>
                  </div>
                  {/* «Frame 1437254872»: с 640 те же 154, что и в колонках строки
                      курса; ниже — ячейка по содержимому (число и поля 8) */}
                  <div className="flex w-full shrink-0 text-center sm:ml-auto sm:w-auto">
                    <span
                      className={clsx(
                        'px-2 text-text-default sm:w-[154px] sm:px-5',
                        competitorText,
                      )}
                    >
                      {formatNumber(comp.buy, locale, 2)}
                    </span>
                    <span
                      className={clsx(
                        'px-2 text-text-default sm:w-[154px] sm:px-5',
                        competitorText,
                      )}
                    >
                      {formatNumber(comp.sell, locale, 2)}
                    </span>
                  </div>
                  {/*
                   * «Отбивка» под блок кнопок строки курса: в макете колонки
                   * конкурента и колонки курса начинаются на одном x, поэтому
                   * здесь стоит невидимая копия блока — 20 + 46 + 8 + 134 = 208.
                   */}
                  <span
                    aria-hidden
                    className="hidden shrink-0 lg:flex lg:invisible lg:items-center lg:gap-2 lg:pl-5"
                  >
                    <span className="w-[46px]" />
                    <span className="inline-flex w-[134px] justify-center text-sm font-medium leading-5">
                      {t('book')}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
