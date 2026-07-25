'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { api, ApiError } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Модалка «Открыть франшизу», вызываемая из карточек действий и навигации
 * приложения — та же заявка, что и форма на лендинге (`LeadForm`), но как
 * всплывающее окно: карточка действия — это ярлык быстрого действия
 * («Забронировать курс», «Подписка на курс» и т. п.), а не переход на
 * маркетинговую страницу. Оболочка диалога — тот же паттерн, что и у
 * `AddressModal` (фокус-ловушка, Esc, блокировка скролла, клик по фону).
 */
export function FranchiseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('franchise');
  const tAddress = useTranslations('addressModal');
  const errorText = useErrorText();
  const titleId = useId();
  const uid = useId();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [clientErr, setClientErr] = useState<{ name?: string; phone?: string }>({});

  const send = useMutation({
    mutationFn: () => api.franchiseLead({ name, phone, city }),
  });
  const resetSend = send.reset;
  const sendError = send.error instanceof ApiError ? send.error : null;

  const fieldError = (key: 'name' | 'phone') =>
    clientErr[key] ?? (sendError?.field === key ? sendError.message : undefined);
  const nameError = fieldError('name');
  const phoneError = fieldError('phone');
  const generalError =
    sendError && sendError.field !== 'name' && sendError.field !== 'phone' ? sendError.message : null;

  // Сброс полей формы при каждом открытии — старая заявка не должна «протухать»
  // под новой. Правка состояния во время рендера — тот же приём, что и в
  // AddressModal/AddressDropdown, без эффекта на локальные setState.
  const [syncedFor, setSyncedFor] = useState(false);
  if (open && !syncedFor) {
    setSyncedFor(true);
    setName('');
    setPhone('');
    setCity('');
    setClientErr({});
  }
  if (!open && syncedFor) setSyncedFor(false);

  // Сброс мутации — императивный вызов внешнего стора, для него эффект уместен.
  useEffect(() => {
    if (open) resetSend();
  }, [open, resetSend]);

  // Фокус: запоминаем инициатора, переводим в поле «Имя», возвращаем при закрытии.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    nameRef.current?.focus();
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [open]);

  // Esc, ловушка Tab внутри модалки и блокировка прокрутки под ней.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
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
  }, [open, onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (send.isPending) return;
    // та же логика, что в franchiseLeadBody на сервере — сразу подсвечиваем поле
    const errs: { name?: string; phone?: string } = {};
    if (name.trim().length < 2) errs.name = 'errors.nameRequired';
    if (phone.replace(/\D/g, '').length < 10) errs.phone = 'errors.phoneRequired';
    setClientErr(errs);
    if (errs.name || errs.phone) {
      (errs.name ? nameRef : phoneRef).current?.focus();
      return;
    }
    send.mutate();
  };

  const inputCls = (invalid: boolean) =>
    `h-[54px] w-full rounded-[20px] border bg-transparent px-4 text-base font-medium text-text-default outline-none transition-colors placeholder:text-text-disabled focus:border-stroke-brand ${
      invalid ? 'border-negative' : 'border-stroke-surface3'
    }`;

  if (!open) return null;

  return (
    <>
      {/* CSS, а не framer-motion: JS-анимация подложки/карточки застревает
          навсегда на промежуточной прозрачности, если вкладка уходит в фон
          в момент открытия — rAF на паузе, opacity никогда не долетает до 1.
          anim-modal-scrim/card гарантируют конечное состояние всегда. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions --
          стандартный паттерн «клик по подложке закрывает модалку»; клавиатурный
          выход — Esc (обработан ниже), мышиный — сюда, обе не мешают друг другу */}
      <div
        className="anim-modal-scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-scrim p-4 py-10"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          ref={containerRef}
          className="anim-modal-card relative w-full max-w-[560px]"
        >
            <button
              type="button"
              onClick={onClose}
              aria-label={tAddress('close')}
              className="absolute -top-14 right-0 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface2-hover lg:-right-14 lg:top-0"
            >
              <Icon name="close" size={20} />
            </button>

            <div className="flex flex-col gap-6 rounded-[20px] border border-stroke-surface1 bg-surface-page-surf1 p-5 sm:p-10">
              <div className="flex flex-col gap-1 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-hardsoft text-text-brand">
                  <Icon name="groups" size={26} filled />
                </span>
                <h2
                  id={titleId}
                  className="mt-2 text-xl font-medium leading-tight text-text-default sm:text-[28px]"
                >
                  {t('title')}
                </h2>
                <p className="text-sm text-text-default sm:text-base">{t('subtitle')}</p>
              </div>

              {send.isSuccess ? (
                <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
                  <Icon name="check_circle" size={40} filled className="text-text-positive" />
                  <p className="text-base text-text-default">{t('done')}</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-2 inline-flex h-[54px] cursor-pointer items-center justify-center rounded-[20px] bg-btn-brand px-8 text-sm font-medium text-text-always-white transition-[filter] hover:brightness-110"
                  >
                    {t('close')}
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} noValidate className="flex flex-col gap-3">
                  <div>
                    <label htmlFor={`${uid}-name`} className="sr-only">
                      {t('name')}
                    </label>
                    <input
                      id={`${uid}-name`}
                      ref={nameRef}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setClientErr((c) => (c.name ? { ...c, name: undefined } : c));
                      }}
                      placeholder={t('name')}
                      autoComplete="name"
                      aria-invalid={Boolean(nameError) || undefined}
                      aria-describedby={nameError ? `${uid}-name-err` : undefined}
                      className={inputCls(Boolean(nameError))}
                    />
                    {nameError && (
                      <p id={`${uid}-name-err`} role="alert" className="mt-1 pl-1 text-xs text-text-negative">
                        {errorText(nameError)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`${uid}-phone`} className="sr-only">
                      {t('phone')}
                    </label>
                    <input
                      id={`${uid}-phone`}
                      ref={phoneRef}
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setClientErr((c) => (c.phone ? { ...c, phone: undefined } : c));
                      }}
                      placeholder={t('phone')}
                      inputMode="tel"
                      autoComplete="tel"
                      aria-invalid={Boolean(phoneError) || undefined}
                      aria-describedby={phoneError ? `${uid}-phone-err` : undefined}
                      className={inputCls(Boolean(phoneError))}
                    />
                    {phoneError && (
                      <p id={`${uid}-phone-err`} role="alert" className="mt-1 pl-1 text-xs text-text-negative">
                        {errorText(phoneError)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`${uid}-city`} className="sr-only">
                      {t('city')}
                    </label>
                    <input
                      id={`${uid}-city`}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t('city')}
                      autoComplete="address-level2"
                      className={inputCls(false)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={send.isPending}
                    className="mt-1 inline-flex h-[54px] w-full cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-btn-brand px-6 text-sm font-medium text-text-always-white transition-[filter] hover:brightness-110 disabled:opacity-60"
                  >
                    {t('cta')}
                  </button>

                  {generalError && (
                    <p role="alert" className="text-center text-sm text-text-negative">
                      {errorText(generalError)}
                    </p>
                  )}
                </form>
              )}
            </div>
        </div>
      </div>
    </>
  );
}
