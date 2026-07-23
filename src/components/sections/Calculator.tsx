'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';

const RATE = 538.45;
const EXCHANGE_RATE = `${String(RATE).replace('.', ',')} ₸ = 1 $`;

/** Точки графика «Динамика курса» — форма кривой из макета. */
const graphPoints = [488.1, 487.6, 487.1, 486.5, 486.6, 486.9, 486.2, 486.7, 486.55, 486.5, 486.6, 486.7];
const graphDelta = '-12.01 %';

const periods = ['year', 'month', 'week', 'day'] as const;
type Period = (typeof periods)[number];

/** Калькулятор валюты с раскрывающейся «Динамикой курса» (график). */
export function Calculator() {
  const t = useTranslations('home.calculator');
  const [give, setGive] = useState('');
  const [get, setGet] = useState('');
  const [graphOpen, setGraphOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('year');
  const [swapped, setSwapped] = useState(false);

  const onGive = (v: string) => {
    setGive(v);
    const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
    setGet(Number.isFinite(n) ? (swapped ? n * RATE : n / RATE).toFixed(2) : '');
  };
  const onGet = (v: string) => {
    setGet(v);
    const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
    setGive(Number.isFinite(n) ? (swapped ? n / RATE : n * RATE).toFixed(2) : '');
  };

  const kzt = { flag: 'kz', code: 'KZT', symbol: '₸' };
  const usd = { flag: 'us', code: 'USD', symbol: '$' };
  const left = swapped ? usd : kzt;
  const right = swapped ? kzt : usd;

  return (
    <section className="container-page pt-6 sm:pt-8">
      <div className="rounded-2xl border border-stroke-surface1 bg-surface-page-surf1 p-5 sm:rounded-[28px] sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="text-xl font-bold text-text-default sm:text-[28px]">{t('title')}</h2>
          <button
            type="button"
            onClick={() => setGraphOpen((v) => !v)}
            className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-2xl border border-stroke-surface2 px-3 text-sm text-text-default transition-colors hover:bg-comp-surface1-hover sm:h-11 sm:px-4"
          >
            <Icon name={graphOpen ? 'visibility' : 'visibility_off'} size={20} />
            {t('dynamics')}
            <motion.span animate={{ rotate: graphOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <Icon name="keyboard_arrow_down" size={20} />
            </motion.span>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {graphOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <Graph period={period} setPeriod={setPeriod} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <AmountField
            placeholder={`${t('give')} (${left.symbol})`}
            value={give}
            onChange={onGive}
            currency={left}
          />
          <button
            type="button"
            onClick={() => setSwapped((v) => !v)}
            aria-label={t('swap')}
            className="mx-auto inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-default transition-colors hover:bg-comp-surface1-hover"
          >
            <motion.span
              animate={{ rotate: swapped ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex"
            >
              <Icon name="swap_vert" size={22} className="lg:hidden" />
              <Icon name="sync_alt" size={22} className="hidden lg:inline" />
            </motion.span>
          </button>
          <AmountField
            placeholder={`${t('get')} (${right.symbol})`}
            value={get}
            onChange={onGet}
            currency={right}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-6 sm:gap-4">
          <span className="text-sm text-text-default">{t('exchangeRate')}</span>
          <span className="rounded-full bg-brand-hardsoft px-3 py-1.5 text-sm font-medium text-text-brand">
            {EXCHANGE_RATE}
          </span>
          <Button className="w-full sm:ml-auto sm:w-auto sm:min-w-44">{t('book')}</Button>
        </div>
      </div>
    </section>
  );
}

function AmountField({
  placeholder,
  value,
  onChange,
  currency,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  currency: { flag: string; code: string };
}) {
  return (
    <div className="flex flex-1 overflow-hidden rounded-2xl bg-surface-page-surf2 transition-colors focus-within:bg-comp-surface2-hover">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="h-14 w-full bg-transparent px-4 text-base text-text-default outline-none placeholder:text-text-disabled sm:h-16 sm:px-5"
      />
      <button
        type="button"
        className="m-2 inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-surface-modal-surf1 px-2.5 text-sm font-medium text-text-default transition-colors hover:bg-comp-surface2-hover sm:px-3 sm:text-base"
      >
        <CurrencyFlag flag={currency.flag} className="h-6 w-9 sm:h-7 sm:w-10" />
        {currency.code}
        <Icon name="keyboard_arrow_down" size={18} />
      </button>
    </div>
  );
}

/** График динамики курса: табы периодов + SVG-линия с анимацией отрисовки. */
function Graph({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
  const t = useTranslations('home.calculator');
  const months = useTranslations('home.months');
  const reduced = useReducedMotion();

  const { path, dots, yLabels } = useMemo(() => {
    const w = 1040;
    const h = 240;
    const min = Math.min(...graphPoints);
    const max = Math.max(...graphPoints);
    const pad = (max - min) * 0.25 || 1;
    const y = (v: number) => h - ((v - min + pad) / (max - min + pad * 2)) * h;
    const x = (i: number) => (i / (graphPoints.length - 1)) * w;
    const pts = graphPoints.map((v, i) => [x(i), y(v)] as const);
    return {
      path: pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' '),
      dots: pts,
      yLabels: [488.5, 487.57, 486.65, 488.5, 488.5],
    };
  }, []);

  return (
    <div className="mt-5 sm:mt-6">
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={clsx(
              'h-9 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors',
              p === period
                ? 'bg-btn-brand text-text-always-white'
                : 'bg-btn-2 text-text-default hover:bg-comp-surface2-hover',
            )}
          >
            {t(`periods.${p}`)}
          </button>
        ))}
      </div>

      <div className="relative mt-4 rounded-2xl bg-surface-page-surf2 p-4 sm:p-5">
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-negative-hardsoft px-2.5 py-1 text-xs font-medium text-text-negative sm:right-5 sm:top-5">
          <Icon name="arrow_downward" size={14} />
          {graphDelta.replace('-', '')}
        </span>

        <div className="flex gap-3 sm:gap-4">
          <div className="flex flex-col justify-between py-1 text-right text-[10px] text-text-negative sm:text-xs">
            {yLabels.map((v, i) => (
              <span key={i}>{v.toFixed(2)}</span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <svg viewBox="0 0 1040 240" className="h-40 w-full sm:h-56" preserveAspectRatio="none">
              {dots.map(([x], i) => (
                <line
                  key={i}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="240"
                  stroke="var(--color-divider-additional)"
                  strokeDasharray="4 6"
                  strokeWidth="1"
                />
              ))}
              <motion.path
                d={path}
                fill="none"
                stroke="var(--color-brand)"
                strokeWidth="2.5"
                initial={reduced ? undefined : { pathLength: 0 }}
                animate={reduced ? undefined : { pathLength: 1 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
              />
              {dots.map(([x, y], i) => (
                <motion.circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="5"
                  fill="var(--color-brand)"
                  initial={reduced ? undefined : { scale: 0, opacity: 0 }}
                  animate={reduced ? undefined : { scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.35 + i * 0.05 }}
                  style={{ transformOrigin: `${x}px ${y}px` }}
                />
              ))}
            </svg>
            <div className="mt-2 flex justify-between text-[10px] text-text-brand sm:text-xs">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i}>{months(String(i))}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
