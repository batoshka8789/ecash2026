'use client';

import { use, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Iconsax } from '@/components/ui/Iconsax';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { counterAmount } from '@/lib/exchange';
import { useCountdown } from '@/lib/hooks';
import { useErrorText } from '@/lib/useErrorText';
import {
  currencySymbol,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPhoneInput,
  formatTime,
} from '@/lib/format';
import { AmountBox } from '@/components/flows/PairFields';
import { useAuth } from '@/lib/auth';
import { accountDisplayName, type ExchangeRequest } from '@/lib/domain';

/**
 * Карточка заявки — экраны состояний из макета:
 * статус 0 «на рассмотрении» (1004:46391), бронь с таймером (1004:37169),
 * предложение индивидуального курса, отмена «Снято с брони», проведена.
 * Пока заявка активна — поллинг; SSE-события инвалидируют кэш мгновенно.
 */
export function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const requestId = Number(id);
  const t = useTranslations('requests');
  const tf = useTranslations('flows');
  const locale = useLocale();
  const errorText = useErrorText();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['requests', 'detail', requestId],
    queryFn: ({ signal }) => api.requests.get(requestId, signal),
    enabled: Number.isInteger(requestId) && requestId > 0,
    refetchInterval: (query) => {
      const r = query.state.data?.request;
      if (!r) return false;
      // ждём ответа казначея — опрашиваем чаще; бронь — раз в 15 с
      if (r.phase === 'pending') return 5_000;
      if (r.phase === 'held') return 15_000;
      return false;
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['requests'] });
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  /**
   * Модальные уведомления о ходе заявки. Экран меняется сам (поллинг), и без
   * них человек не понимал, что произошло: страница молча превращалась то в
   * таймер брони, то в предложение курса.
   *
   * Три момента:
   *  — 'waiting' — заявка индивидуального курса отправлена и ждёт казначея
   *    (показывается сразу при входе на карточку — это и есть промежуточное
   *    окно ожидания из макета);
   *  — 'offer'   — казначей ответил, нужно решение клиента;
   *  — 'booked'  — бронь оформлена.
   *
   * Ключ состояния — не только phase: переход «ждём → предложение» происходит
   * внутри одной фазы pending, и по одной фазе его не поймать.
   */
  const req = q.data?.request;
  const stage = !req
    ? null
    : req.needsClientConfirmation
      ? 'offer'
      : req.phase === 'held'
        ? 'booked'
        : req.phase === 'pending' && req.isIndividual
          ? 'waiting'
          : 'other';

  const [seenStage, setSeenStage] = useState<string | null>(null);
  const [modal, setModal] = useState<'waiting' | 'offer' | 'booked' | null>(null);
  if (stage && stage !== seenStage) {
    // «ожидание» показываем и при первом заходе — клиент только что отправил
    // заявку; «предложение» и «бронь» — только когда они наступают на глазах
    if (stage === 'waiting' && seenStage === null) setModal('waiting');
    if (seenStage !== null && (stage === 'offer' || stage === 'booked')) setModal(stage);
    setSeenStage(stage);
  }

  const cancelMut = useMutation({
    mutationFn: () => api.requests.cancel(requestId),
    onSuccess: invalidate,
  });
  const confirmMut = useMutation({
    mutationFn: () => api.requests.confirmIndividual(requestId),
    onSuccess: invalidate,
  });
  const rejectMut = useMutation({
    mutationFn: () => api.requests.rejectIndividual(requestId),
    onSuccess: invalidate,
  });

  const r = q.data?.request;

  if (q.isPending) {
    return (
      <div className="container-page pt-10" aria-busy>
        <div className="mx-auto h-64 max-w-2xl animate-pulse rounded-3xl bg-surface-page-surf1" />
      </div>
    );
  }

  if (q.isError || !r) {
    const message =
      q.error instanceof ApiError ? errorText(q.error.message) : errorText('errors.notFound');
    return (
      <div className="container-page flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-text-disabled">{message}</p>
        <Link href="/requests" className="text-text-brand hover:opacity-80">
          {t('toList')}
        </Link>
      </div>
    );
  }

  const mutError = [cancelMut, confirmMut, rejectMut]
    .map((m) => (m.error instanceof ApiError ? errorText(m.error.message) : null))
    .find(Boolean);

  const cancellable = r.phase === 'pending' || r.phase === 'held';
  const foreign = r.currencyFrom === 'KZT' ? r.currencyTo : r.currencyFrom;

  return (
    <div className="container-page flex flex-col gap-5 pt-10">
      {modal === 'waiting' && (
        <StatusModal
          icon="hourglass_top"
          title={t('waitingModal.title')}
          text={t('waitingModal.text')}
          ok={t('waitingModal.ok')}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'offer' && (
        <StatusModal
          icon="hourglass_top"
          title={t('offerModal.title')}
          text={t('offerModal.text', { min: r.reserveMinutes })}
          note={r.acceptComment}
          ok={t('offerModal.ok')}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'booked' && (
        <StatusModal
          icon="verified_user"
          title={t('bookedModal.title')}
          text={t('bookedModal.text')}
          ok={t('bookedModal.ok')}
          onClose={() => setModal(null)}
        />
      )}

      <StatusHead request={r} />

      {/* Заголовок «Казначей предложил курс» убран по требованию заказчика:
          статус уже сказан выше (StatusHead), а кнопки решения перенесены
          в самый низ экрана — человек сначала смотрит детали заявки. */}
      {r.needsClientConfirmation && (
        <section className="rounded-2xl bg-surface-page-surf1 p-5 text-center sm:rounded-3xl sm:p-8">
          <p className="text-sm text-text-disabled">
            {t('offerText', { min: r.reserveMinutes })}
          </p>
          <p className="mt-4 text-2xl font-bold text-text-brand">
            {formatNumber(r.rate, locale)} ₸ = 1 {currencySymbol(foreign)}
          </p>
          {r.reservedUntil && <OfferCountdown until={r.reservedUntil} />}
        </section>
      )}

      <div>
        <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('details')}</h2>
        <p className="mt-1 text-sm text-text-disabled">
          {t('sentAt')}: {formatDateTime(r.createdAt, locale)} · {t('number', { id: r.requestId })}
        </p>
      </div>

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <h3 className="text-lg font-bold text-text-default sm:text-xl">{t('pair')}</h3>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
          {/* value — currencyFrom, amount — currencyTo (контракт Ecash,
              раздел 4.3) — прямо, без ветвления по типу валюты */}
          <AmountBox
            label={`${tf('pair.give')} (${currencySymbol(r.currencyFrom)})`}
            value={formatMoney(r.value, locale)}
            readOnly
            currency={r.currencyFrom}
          />
          {/* Сумма получения считается У НАС из value и rate, а не берётся из
              поля amount апстрима. Поле производное, и после ответа казначея
              по индивидуальному курсу ядро пересчитывает его умножением без
              учёта направления: живой пример — заявка №6729, отдал 10 000 ₸
              по курсу 461, ядро прислало amount = 4 610 000 $ вместо 21,69.
              Показывать человеку абсурдную сумму денег нельзя, а value и
              rate — согласованные факты сделки, из которых сумма выводится
              однозначно (counterAmount, под тестами). Для обычной брони
              формула совпадает с тем, что мы сами и отправили. Дефект ядра
              задокументирован в HANDOFF 9.5. */}
          <AmountBox
            label={`${tf('pair.get')} (${currencySymbol(r.currencyTo)})`}
            value={formatMoney(counterAmount(r.value, r.rate, r.currencyFrom) || r.amount, locale)}
            readOnly
            currency={r.currencyTo}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-disabled">
          {t('rate')}:
          <span className="rounded-full bg-surface-page-surf2 px-3 py-1.5 text-text-default">
            {formatNumber(r.rate, locale)} ₸ = 1 {currencySymbol(foreign)}
          </span>
        </div>
        {/* комментарий клиента — сюда попадает выбранный тип купюр */}
        {r.comment && (
          <p className="mt-4 text-sm text-text-disabled">
            {t('commentLabel')}: <span className="text-text-default">{r.comment}</span>
          </p>
        )}
        {/* Комментарий казначея. Показывается на ЛЮБОЙ стадии, а не только при
            отмене: им объясняют условия сделки (например, что нет мелких или
            крупных купюр, заказанных клиентом) — это нужно видеть до решения
            по курсу, а не после. При отмене та же строка — «Причина». */}
        {r.acceptComment && (
          <p className="mt-4 text-sm text-text-disabled">
            {r.phase === 'cancelled' ? t('reason') : t('treasurerComment')}:{' '}
            <span className="text-text-default">{r.acceptComment}</span>
          </p>
        )}
        {r.printedTicket && (
          <p className="mt-4 text-sm text-text-disabled">
            {t('ticket')}: <span className="font-mono text-text-default">{r.printedTicket}</span>
          </p>
        )}
      </section>

      {r.depId != null && <BranchBlock depId={r.depId} />}

      <YourDataBlock />

      {r.history.length > 0 && (
        <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
          <h3 className="text-lg font-bold text-text-default sm:text-xl">{t('history')}</h3>
          <ol className="mt-4 flex flex-col gap-3">
            {r.history.map((h, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <Icon name="schedule" size={18} className="mt-0.5 shrink-0 text-text-disabled" />
                <span>
                  <span className="text-text-default">
                    {h.oldStatusName} → {h.statusName}
                  </span>
                  <span className="ml-2 text-text-disabled">
                    {formatDateTime(h.updatedAt, locale)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {mutError && (
        <p role="alert" className="text-center text-sm text-text-negative">
          {mutError}
        </p>
      )}

      {/* Решение по индивидуальному курсу — внизу экрана, после всех деталей */}
      {r.needsClientConfirmation && (
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            onClick={() => confirmMut.mutate()}
            disabled={confirmMut.isPending || rejectMut.isPending}
            className="sm:min-w-44"
          >
            {t('accept')}
          </Button>
          <Button
            variant="surf2"
            onClick={() => rejectMut.mutate()}
            disabled={confirmMut.isPending || rejectMut.isPending}
            className="sm:min-w-44"
          >
            {t('decline')}
          </Button>
        </div>
      )}

      <div className="flex flex-col items-center gap-3 pb-6 sm:flex-row sm:justify-between">
        <Link
          href="/requests"
          className="inline-flex items-center gap-1 text-sm text-text-disabled transition-colors hover:text-text-default"
        >
          <Icon name="arrow_back" size={18} />
          {t('toList')}
        </Link>
        {/* Отмена недоступна, когда бронь уже действует (phase === 'held'):
            и на экране таймера брони, и после согласования индивидуального
            курса — согласованную сделку клиент отменить не может. */}
        {cancellable && !r.needsClientConfirmation && r.phase !== 'held' && (
          <Button
            variant="surf2"
            onClick={() => cancelMut.mutate()}
            disabled={cancelMut.isPending}
          >
            {t('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Блок «Адрес отделения» — фрейм 1004:37169: адрес, часы, «На карте». */
function BranchBlock({ depId }: { depId: number }) {
  const t = useTranslations('requests');

  const q = useQuery({
    queryKey: ['departmentsInfo', 'single', depId],
    queryFn: ({ signal }) => api.departments.info(depId, signal).then((r) => r.department),
    staleTime: 5 * 60_000,
  });

  const dep = q.data;
  if (!dep) return null;

  return (
    <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
      <h3 className="text-lg font-bold text-text-default sm:text-xl">{t('branch')}</h3>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-2 text-sm text-text-default sm:text-base">
            <Icon
              name="account_balance"
              size={18}
              className="mt-0.5 shrink-0 text-text-disabled"
            />
            <span className="min-w-0">{dep.address}</span>
          </div>
          {dep.timetable && (
            <div className="mt-1 text-sm text-text-disabled">
              {dep.timetable.openTime} - {dep.timetable.closeTime}
            </div>
          )}
        </div>
        <Link
          href={`/locations?view=map&depId=${depId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-page-surf2 px-4 py-2 text-sm text-text-default transition-colors hover:bg-comp-surface2-hover"
        >
          <Icon name="location_on" size={16} filled />
          {t('onMapBtn')}
        </Link>
      </div>
    </section>
  );
}

/** Блок «Ваши данные» — телефон и имя аккаунта, как в макете заявки. */
function YourDataBlock() {
  const t = useTranslations('requests');
  const { account } = useAuth();
  if (!account) return null;

  const name = accountDisplayName(account);

  return (
    <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
      <h3 className="text-lg font-bold text-text-default sm:text-xl">{t('yourData')}</h3>
      <div className="mt-4 flex flex-col gap-2 text-sm text-text-default sm:text-base">
        {account.phoneNumber && (
          <div className="flex items-center gap-2">
            <Iconsax name="call" size={18} className="text-text-disabled" />
            {formatPhoneInput(account.phoneNumber)}
          </div>
        )}
        {name && (
          <div className="flex items-center gap-2">
            <Icon name="person" size={18} className="text-text-disabled" />
            {name}
          </div>
        )}
      </div>
    </section>
  );
}

/** Шапка состояния: щит + бейджи + заголовок + таймер брони. */
/** «7 704 *** ** 84» — как в макете: видны код оператора и две последние цифры. */
/** Маскированный номер в утверждённом формате проекта: +7 (775) *** ** 84. */
function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 6) return phone;
  const local = d.length === 11 ? d.slice(1) : d;
  return `+7 (${local.slice(0, 3)}) *** ** ${local.slice(-2)}`;
}

function StatusHead({ request: r }: { request: ExchangeRequest }) {
  const t = useTranslations('requests');
  const tn = useTranslations('notifications');
  const { account } = useAuth();

  // Отказ клиента от индивидуального курса — это «Отмена», а не «Снято с
  // брони»: брони по такой заявке ещё не было, отменять было нечего.
  const title = r.needsClientConfirmation
    ? tn('titles.offerReviewed')
    : r.phase === 'held'
      ? tn('titles.bookedPair')
      : r.phase === 'pending'
        ? r.isIndividual
          ? tn('titles.offerSent')
          : t('status0')
        : r.phase === 'done'
          ? t('status1')
          : r.isIndividual
            ? t('status3')
            : t('cancelled');

  const iconName =
    r.phase === 'held' || r.phase === 'done'
      ? 'verified_user'
      : r.phase === 'pending'
        ? 'hourglass_top'
        : 'cancel';

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={clsx(
          'flex h-20 w-20 items-center justify-center rounded-full',
          r.phase === 'cancelled' ? 'bg-surface-page-surf2' : 'bg-brand-hardsoft',
        )}
      >
        <span
          className={clsx(
            'flex h-12 w-12 items-center justify-center rounded-full',
            r.phase === 'cancelled'
              ? 'bg-surface-page-surf1 text-text-disabled'
              : 'bg-brand text-text-always-white',
          )}
        >
          <Icon name={iconName} size={26} filled />
        </span>
      </span>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {r.phase === 'held' && (
          <span className="rounded-md bg-alert px-2 py-0.5 text-[11px] font-medium text-text-inverted">
            {tn('badges.booking30').replace('30', String(r.reserveMinutes))}
          </span>
        )}
        {r.isIndividual && (
          <span className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-medium text-text-always-white">
            {tn('badges.individual')}
          </span>
        )}
        {/* маскированный номер заявителя — бейдж из макета 1004:37169 */}
        {account?.phoneNumber && (
          <span className="rounded-md bg-brand-hardsoft px-2 py-0.5 text-[11px] font-medium text-text-brand">
            {tn('badges.numberValue', { value: maskPhone(account.phoneNumber) })}
          </span>
        )}
      </div>

      <h1 className="mt-3 text-lg font-bold text-text-default sm:text-2xl">{title}</h1>

      {r.phase === 'pending' && !r.needsClientConfirmation && (
        <p className="mt-2 max-w-md text-sm text-text-disabled" aria-live="polite">
          {t('awaiting')}
        </p>
      )}

      {r.phase === 'held' && r.reservedUntil && <HoldCountdown until={r.reservedUntil} />}
    </div>
  );
}

/**
 * Модальное уведомление о смене состояния заявки — по образцу AuthModal:
 * скрим + Esc + клик по подложке. Один компонент на три случая (отправлена
 * заявка, ответил казначей, бронь оформлена): различаются только иконка и
 * тексты, дублировать разметку смысла нет.
 */
function StatusModal({
  icon,
  title,
  text,
  note,
  ok,
  onClose,
}: {
  icon: string;
  title: string;
  text: string;
  /** дополнительная строка — напр. комментарий казначея */
  note?: string | null;
  ok: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="anim-modal-scrim fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="anim-modal-card w-full max-w-[420px] rounded-3xl bg-surface-page-surf1 p-6 text-center sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-hardsoft text-text-brand">
          <Icon name={icon} size={28} filled />
        </span>
        <h2 className="mt-4 text-lg font-bold text-text-default sm:text-xl">{title}</h2>
        <p className="mt-2 text-sm text-text-disabled">{text}</p>
        {note && (
          <p className="mt-3 rounded-2xl bg-surface-page-surf2 px-4 py-3 text-sm text-text-default">
            {note}
          </p>
        )}
        <Button className="mt-6 w-full" onClick={onClose}>
          {ok}
        </Button>
      </div>
    </div>
  );
}

/** Таймер брони — от reservedUntil (60 мин с ответа казначея), по серверному времени. */
function HoldCountdown({ until }: { until: string }) {
  const t = useTranslations('requests');
  const tf = useTranslations('flows.done');
  const locale = useLocale();
  const left = useCountdown(until);
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');

  if (left <= 0) {
    return (
      <p className="mt-3 text-sm text-text-negative" role="status">
        {t('expired')}
      </p>
    );
  }
  return (
    <>
      <div className="mt-3 flex items-center gap-1 text-lg text-text-default" role="timer">
        <span className="sr-only">{t('timeLeft')}</span>
        <span className="rounded-lg bg-surface-page-surf2 px-3 py-1.5">
          {mm} {tf('min')}
        </span>
        :
        <span className="rounded-lg bg-surface-page-surf2 px-3 py-1.5">
          {ss} {tf('sec')}
        </span>
      </div>
      {/* Обратный отсчёт не отвечает на вопрос «до скольки?» — показываем и
          само время окончания брони (требование заказчика). */}
      <p className="mt-2 text-sm text-text-disabled">
        {t('bookedUntil')} {formatTime(until, locale)}
      </p>
    </>
  );
}

function OfferCountdown({ until }: { until: string }) {
  const t = useTranslations('requests');
  const locale = useLocale();
  const left = useCountdown(until);
  if (left <= 0)
    return (
      <p className="mt-2 text-sm text-text-negative" role="status">
        {t('expired')}
      </p>
    );
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');
  return (
    // «Бронь действует ещё» здесь было неверно: брони по предложению курса
    // ещё нет, идёт срок на решение клиента.
    <p className="mt-2 text-sm text-text-disabled" role="timer">
      {t('offerTimeLeft')}: {mm}:{ss} ({formatTime(until, locale)})
    </p>
  );
}
