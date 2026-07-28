'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { api, ApiError, type NotificationDto } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCountdown } from '@/lib/hooks';
import { formatBranchAddress } from '@/lib/branch-address';
import { intlLocale } from '@/lib/format';
import { useErrorText } from '@/lib/useErrorText';

/** Дата уведомления в макете — без времени: «12.06.2026» [961:32160]. */
function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** «7 704 *** ** 84» — как в макете: видны код оператора и две последние цифры. */
function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 6) return phone;
  return `${d.slice(0, 1)} ${d.slice(1, 4)} *** ** ${d.slice(-2)}`;
}

/**
 * Таб-бар уведомлений — «tabbar» [1810:138545]: подложка #1A1A1A r24,
 * высота 62 (54 на ≤480), кнопки с иконкой 20 и зазором 8.
 */
function NotificationTabs({
  value,
  onChange,
  tabs,
}: {
  value: 'actual' | 'history';
  onChange: (v: 'actual' | 'history') => void;
  tabs: { value: 'actual' | 'history'; icon: string; label: string }[];
}) {
  return (
    <div className="flex h-[54px] gap-1 rounded-3xl bg-surface-page-bg p-0.5 md:h-[62px]">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={clsx(
              'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[20px] pl-4 pr-6 text-sm font-medium leading-5 transition-colors',
              active
                ? 'bg-surface-page-surf1 text-text-default'
                : 'text-text-default hover:text-text-brand',
            )}
          >
            <Icon name={tab.icon} size={20} filled={active} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Страница уведомлений: табы Актуальное / История, проекция заявок и подписок. */
export function NotificationsCard() {
  const t = useTranslations('notifications');
  const tSystem = useTranslations('system');
  const errorText = useErrorText();
  const [tab, setTab] = useState<'actual' | 'history'>('actual');

  const query = useQuery({
    queryKey: ['notifications', tab],
    queryFn: ({ signal }) => api.notifications.list(tab, signal),
    // при смене таба держим прошлый список и приглушаем его, пока грузится новый
    placeholderData: keepPreviousData,
  });
  const { data } = query;
  const errorStatus = query.error instanceof ApiError ? query.error.status : undefined;

  // Адрес отделения в строке уведомления берём из общего списка отделений:
  // ключ тот же, что на /locations и в профиле, — запрос переиспользуется.
  const deps = useQuery({
    queryKey: ['departments'],
    queryFn: ({ signal }) => api.departments.list(signal),
    staleTime: 5 * 60_000,
  });

  /** requestId → человекочитаемый адрес отделения заявки. */
  const addressByRequest = useMemo(() => {
    const byDep = new Map((deps.data?.departments ?? []).map((d) => [d.depId, d.address]));
    const out = new Map<number, string>();
    for (const r of data?.requests ?? []) {
      const raw = r.depId === null ? undefined : byDep.get(r.depId);
      if (raw) out.set(r.requestId, formatBranchAddress(raw));
    }
    return out;
  }, [deps.data, data]);

  return (
    <div className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 px-4 py-8 max-xl:rounded-t-none md:px-8">
      <NotificationTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'actual', icon: 'notifications', label: t('tabs.actual') },
          { value: 'history', icon: 'history', label: t('tabs.history') },
        ]}
      />

      {query.isPending && (
        <div aria-hidden className="mt-10 flex flex-col gap-7">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex animate-pulse gap-3">
              <span className="h-[50px] w-[50px] shrink-0 rounded-2xl bg-surface-page-surf2" />
              <div className="flex flex-1 flex-col gap-2">
                <span className="h-4 w-2/5 rounded-full bg-surface-page-surf2" />
                <span className="h-4 w-3/5 rounded-full bg-surface-page-surf2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!query.isPending && query.isError && !data && (
        <div className="flex flex-col items-center gap-3 py-10">
          {errorStatus === 401 ? (
            <p className="text-sm text-text-negative">{t('needLogin')}</p>
          ) : (
            <>
              <p className="text-sm text-text-negative">{errorText(query.error.message)}</p>
              <button
                type="button"
                onClick={() => query.refetch()}
                className="cursor-pointer rounded-full border border-stroke-brand px-4 py-2 text-sm font-medium text-text-brand transition-colors hover:bg-brand-hardsoft"
              >
                {tSystem('retry')}
              </button>
            </>
          )}
        </div>
      )}

      {data && data.notifications.length === 0 && (
        <p className="py-10 text-center text-sm text-text-disabled">{t('empty')}</p>
      )}

      {data && data.notifications.length > 0 && (
        <div
          className={clsx(
            '-mx-4 mt-10 divide-y divide-divider-additional transition-opacity md:-mx-8',
            query.isFetching && 'opacity-60',
          )}
        >
          {data.notifications.map((n, i) => (
            <NotificationRow
              key={n.id}
              n={n}
              branch={n.requestId === null ? null : (addressByRequest.get(n.requestId) ?? null)}
              // подсветку «нового» в макете несёт только верхняя карточка списка
              fresh={i === 0 && tab === 'actual'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  booking30: 'bg-alert-hardsoft text-text-additional',
  rateAlert: 'bg-alert-hardsoft text-text-additional',
  individual: 'bg-alert-hardsoft text-text-additional',
};

/** Бейджи с известным переводом; чужой бейдж показываем как есть. */
const knownBadges = new Set(['booking30', 'rateAlert', 'individual']);

/** «a-button-main» [965:34101] 256×38: padding 8 16, r20, колонкой через 8. */
const actionCls = (variant: 'solid' | 'outline') =>
  clsx(
    'inline-flex h-[38px] w-full max-w-[256px] cursor-pointer items-center justify-center rounded-[20px] border px-4 text-sm font-medium leading-5 transition-colors disabled:cursor-default disabled:opacity-60',
    variant === 'solid'
      ? 'border-btn-brand bg-btn-brand text-text-always-white hover:brightness-110'
      : 'border-stroke-brand text-text-brand hover:bg-brand-hardsoft',
  );

function NotificationRow({
  n,
  branch,
  fresh,
}: {
  n: NotificationDto;
  branch: string | null;
  fresh: boolean;
}) {
  const t = useTranslations('notifications');
  const tRequests = useTranslations('requests');
  const locale = useLocale();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const { account } = useAuth();

  const act = useMutation({
    mutationFn: ({
      kind,
      id,
    }: {
      kind: 'accept' | 'decline' | 'cancel' | 'disable';
      id: number | string;
    }): Promise<unknown> => {
      if (kind === 'accept') return api.requests.confirmIndividual(id as number);
      if (kind === 'decline') return api.requests.rejectIndividual(id as number);
      if (kind === 'disable') return api.rateAlerts.remove(id as string);
      return api.requests.cancel(id as number);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['notifications'] }),
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['rate-alerts'] }),
      ]);
    },
  });

  const requestId = n.requestId;
  const canConfirm =
    requestId !== null && n.needsClientConfirmation && n.actions.includes('individual');
  const canCancel = requestId !== null && n.phase === 'held';
  const canResume = n.actions.includes('resume');
  const canDisable = n.alertId !== null && n.actions.includes('disable');

  return (
    <div className="px-4 py-4 md:px-8 md:py-7">
      <div className="flex gap-3">
        <span className="relative h-[50px] w-[50px] shrink-0 rounded-2xl border border-surface-page-surf3">
          <CurrencyFlag
            flag="kz"
            className="absolute left-[9px] top-[9px] h-5 w-[25px] rounded-[5px]"
          />
          <CurrencyFlag
            flag="us"
            className="absolute bottom-[9px] right-[9px] h-5 w-[25px] rounded-[5px]"
          />
        </span>

        <div className="min-w-0 flex-1">
          {/* «Frame 1437255320» [965:32751]: бейджи слева (переносом), дата справа */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {n.badges.map((b) => (
                <span
                  key={b}
                  className={clsx(
                    'rounded-xl px-2 py-0.5 text-xs font-bold leading-[18px]',
                    badgeStyles[b] ?? 'bg-surface-page-surf2 text-text-default',
                  )}
                >
                  {knownBadges.has(b) ? t(`badges.${b}`) : b}
                </span>
              ))}
              {/* «big badge» [1167:64926]: номер заявителя, 14/500 на фоне #F15A25 20% */}
              {requestId !== null && account?.phoneNumber && (
                <span className="rounded-xl bg-brand-hardsoft px-2 py-0.5 text-sm font-medium leading-[18px] text-text-brand">
                  {t('badges.numberValue', { value: maskPhone(account.phoneNumber) })}
                </span>
              )}
            </div>
            {/* «date» [961:32167]: 12/500 lh16, у непрочитанной строки — точка 6 */}
            <span
              className={clsx(
                'mt-[3px] flex shrink-0 items-center gap-1 text-xs font-medium leading-4',
                fresh ? 'text-text-default' : 'text-[#707070]',
              )}
            >
              {formatDate(n.createdAt, locale)}
              {fresh && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-text-default" />}
            </span>
          </div>

          <div className="mt-1 text-lg font-bold leading-6 text-text-default">
            {t(`titles.${n.titleKey}`)}
          </div>

          {n.phase === 'held' && n.reservedUntil && <HoldCountdown until={n.reservedUntil} />}
          {n.phase === 'cancelled' && (
            /* «Booking Timer» [1187:60553] 133×38: обводка #4C4C4C, текст 16/400 */
            <span className="mt-3 inline-flex h-[38px] items-center rounded-xl border border-divider-elevated bg-surface-modal-surf1 px-3 text-base leading-[1.24] text-text-disabled">
              {t('cancelled')}
            </span>
          )}

          {/* «Frame 1437255296» [943:45729]: строки 16 через 6, Inter SemiBold 14/1.0 */}
          <div className="mt-3 flex flex-col gap-1.5 border-t border-divider-elevated pt-3 font-inter text-sm font-semibold leading-none">
            <span
              className={clsx(
                'flex h-4 items-center gap-2',
                n.side === 'buy' ? 'text-text-positive' : 'text-text-negative',
              )}
            >
              <Icon
                name={n.side === 'buy' ? 'check_box' : 'indeterminate_check_box'}
                size={16}
                filled
              />
              {t(n.side === 'buy' ? 'buy' : 'sell')}
            </span>
            <span className="flex h-4 items-center gap-2 text-text-disabled">
              <Icon name="paid" size={16} />
              {n.amount}
            </span>
            {branch && (
              <span className="flex h-4 items-center gap-2 text-text-disabled">
                <Icon name="account_balance" size={16} />
                <span className="truncate underline">{branch}</span>
              </span>
            )}
          </div>

          {(canConfirm || canCancel || canResume || canDisable) && (
            <div className="mt-6 flex flex-col items-start gap-2">
              {requestId !== null && (
                <>
                  {canConfirm && (
                    <>
                      <button
                        type="button"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ kind: 'accept', id: requestId })}
                        className={actionCls('solid')}
                      >
                        {tRequests('accept')}
                      </button>
                      <button
                        type="button"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ kind: 'decline', id: requestId })}
                        className={actionCls('outline')}
                      >
                        {tRequests('decline')}
                      </button>
                    </>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ kind: 'cancel', id: requestId })}
                      className={actionCls('outline')}
                    >
                      {tRequests('cancel')}
                    </button>
                  )}
                </>
              )}
              {canResume && (
                <Link href="/subscribe" className={actionCls('outline')}>
                  {t('actions.resume')}
                </Link>
              )}
              {canDisable && (
                <button
                  type="button"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ kind: 'disable', id: n.alertId! })}
                  className={actionCls('outline')}
                >
                  {t('actions.disable')}
                </button>
              )}
            </div>
          )}

          <div aria-live="polite">
            {act.error && (
              <p className="mt-2 text-sm text-text-negative">{errorText(act.error.message)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Живой таймер брони — отдельный компонент, чтобы секундный тик не перерисовывал
 * список. «Booking Timer» [1187:60388] 148×38: обводка #4C4C4C, padding 4,
 * число 16/400 lh19.84, единица измерения 14/400 lh15.4.
 */
function HoldCountdown({ until }: { until: string }) {
  const t = useTranslations('notifications');
  const left = useCountdown(until);
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="mt-3 flex h-[38px] w-fit items-center gap-1 rounded-xl border border-divider-elevated bg-surface-modal-surf1 p-1 text-base leading-[1.24] text-text-default">
      <span className="flex items-baseline gap-1 rounded-2xl px-2 py-1">
        {mm}
        <span className="text-sm leading-[1.1]">{t('min')}</span>
      </span>
      :
      <span className="flex items-baseline gap-1 rounded-2xl px-2 py-1">
        {ss}
        <span className="text-sm leading-[1.1]">{t('sec')}</span>
      </span>
    </div>
  );
}
