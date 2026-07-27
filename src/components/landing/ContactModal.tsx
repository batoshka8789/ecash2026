'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { api, ApiError } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Маска номера — формат из футера лендинга («+7 (705) 908 90 73»). */
function formatPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('7') || digits.startsWith('8')) digits = digits.slice(1);
  digits = digits.slice(0, 10);

  if (digits.length === 0) return '';
  let out = `+7 (${digits.slice(0, 3)}`;
  if (digits.length >= 3) out += ')';
  if (digits.length > 3) out += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += ` ${digits.slice(6, 8)}`;
  if (digits.length > 8) out += ` ${digits.slice(8, 10)}`;
  return out;
}

/**
 * Модалка заявки для обеих кнопок «Связаться» лендинга франшизы (секции
 * «Ecash — это сеть…» и баннер «Свяжитесь…») — контакты плюс квалификация
 * (капитал, опыт, роль/роли), по референсу пользователя. Оболочка диалога —
 * тот же паттерн, что и у FranchiseModal (фокус-ловушка, Esc, блокировка
 * скролла, клик по фону, CSS-анимация без framer-motion). Логотип сверху —
 * tone="onDark": лендинг форсирует тёмную тему классом .theme-dark, но
 * Logo с tone="auto" переключается по data-theme, а не по этому классу —
 * на светлой теме сайта показал бы тёмный вариант на тёмном фоне лендинга.
 */
export function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('landing.contactModal');
  const errorText = useErrorText();
  const titleId = useId();
  const uid = useId();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [funds, setFunds] = useState('');
  const [experience, setExperience] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [clientErr, setClientErr] = useState<{ name?: string; phone?: string }>({});

  const presetTags = [t('tagEntrepreneur'), t('tagInvestor'), t('tagDirector')];

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value || tags.includes(value)) return;
    setTags((prev) => [...prev, value]);
  };
  const removeTag = (value: string) => setTags((prev) => prev.filter((tag) => tag !== value));

  const send = useMutation({
    mutationFn: () => api.franchiseLead({ name, phone, funds, experience, tags }),
  });
  const resetSend = send.reset;
  const sendError = send.error instanceof ApiError ? send.error : null;

  const fieldError = (key: 'name' | 'phone') =>
    clientErr[key] ?? (sendError?.field === key ? sendError.message : undefined);
  const nameError = fieldError('name');
  const phoneError = fieldError('phone');
  const generalError =
    sendError && sendError.field !== 'name' && sendError.field !== 'phone' ? sendError.message : null;

  // Сброс полей при каждом открытии — та же схема, что и в FranchiseModal:
  // правка состояния во время рендера, без эффекта на локальные setState.
  const [syncedFor, setSyncedFor] = useState(false);
  if (open && !syncedFor) {
    setSyncedFor(true);
    setName('');
    setPhone('');
    setFunds('');
    setExperience('');
    setTags([]);
    setTagInput('');
    setClientErr({});
  }
  if (!open && syncedFor) setSyncedFor(false);

  useEffect(() => {
    if (open) resetSend();
  }, [open, resetSend]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    nameRef.current?.focus();
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [open]);

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

  // Заливка без обводки, как у полей калькулятора (Calculator.tsx) — по
  // референсу поля модалки это сплошные surf2-плашки, а не рамка на
  // прозрачном фоне. border-transparent, а не отсутствие border вовсе,
  // чтобы invalid-рамка не сдвигала разметку (тот же приём, что и в
  // SubscribeFlow).
  const inputCls = (invalid: boolean) =>
    clsx(
      'h-[54px] w-full rounded-[20px] border bg-surface-page-surf2 px-4 text-base font-medium text-text-default outline-none transition-colors placeholder:text-text-disabled focus:bg-comp-surface2-hover',
      invalid ? 'border-negative' : 'border-transparent',
    );

  if (!open) return null;

  return (
    // стандартный паттерн «клик по подложке закрывает модалку», как в FranchiseModal;
    // клавиатурный выход — Esc (обработан выше)
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="anim-modal-scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-scrim p-4 py-10"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div ref={containerRef} className="anim-modal-card relative w-full max-w-[560px]">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute -top-14 right-0 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface2-hover lg:-right-14 lg:top-0"
        >
          <Icon name="close" size={20} />
        </button>

        <div className="flex max-h-[85vh] flex-col gap-6 overflow-y-auto rounded-[20px] border border-stroke-surface1 bg-surface-page-surf1 p-5 sm:p-10">
          <div className="flex flex-col items-center gap-5">
            <Logo tone="onDark" />
            <h2 id={titleId} className="text-center text-xl font-medium leading-tight text-text-default sm:text-[28px]">
              {t('title')}
            </h2>
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
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
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
                    className={inputCls(Boolean(nameError))}
                  />
                  {nameError && (
                    <p role="alert" className="mt-1 pl-1 text-xs text-text-negative">
                      {errorText(nameError)}
                    </p>
                  )}
                </div>
                <div className="flex-1">
                  <label htmlFor={`${uid}-phone`} className="sr-only">
                    {t('phone')}
                  </label>
                  <input
                    id={`${uid}-phone`}
                    ref={phoneRef}
                    value={phone}
                    onChange={(e) => {
                      setPhone(formatPhoneInput(e.target.value));
                      setClientErr((c) => (c.phone ? { ...c, phone: undefined } : c));
                    }}
                    placeholder={t('phone')}
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={18}
                    aria-invalid={Boolean(phoneError) || undefined}
                    className={inputCls(Boolean(phoneError))}
                  />
                  {phoneError && (
                    <p role="alert" className="mt-1 pl-1 text-xs text-text-negative">
                      {errorText(phoneError)}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor={`${uid}-funds`} className="sr-only">
                  {t('funds')}
                </label>
                <input
                  id={`${uid}-funds`}
                  value={funds}
                  onChange={(e) => setFunds(e.target.value)}
                  placeholder={t('funds')}
                  className={inputCls(false)}
                />
              </div>

              <div>
                <label htmlFor={`${uid}-experience`} className="sr-only">
                  {t('experience')}
                </label>
                <textarea
                  id={`${uid}-experience`}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder={t('experience')}
                  rows={3}
                  className="w-full resize-none rounded-[20px] border border-transparent bg-surface-page-surf2 px-4 py-3.5 text-base font-medium text-text-default outline-none transition-colors placeholder:text-text-disabled focus:bg-comp-surface2-hover"
                />
              </div>

              {/* Тег-инпут «Кто вы?»: выбранные роли — снимаемые пилюли, плюс
                  свободный ввод своего варианта (Enter/запятая добавляет тег). */}
              <div>
                <div className="flex min-h-[54px] flex-wrap items-center gap-2 rounded-[20px] border border-transparent bg-surface-page-surf2 px-3 py-2 transition-colors focus-within:bg-comp-surface2-hover">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-page-surf3 px-3 py-1.5 text-sm text-text-default"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={tag}
                        className="cursor-pointer text-text-disabled transition-colors hover:text-text-default"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTag(tagInput);
                        setTagInput('');
                      }
                    }}
                    placeholder={tags.length === 0 ? t('tagsLabel') : t('tagsPlaceholder')}
                    className="min-w-[140px] flex-1 bg-transparent px-1 py-1.5 text-base text-text-default outline-none placeholder:text-text-disabled"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {presetTags
                    .filter((preset) => !tags.includes(preset))
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => addTag(preset)}
                        className="cursor-pointer rounded-full border border-stroke-surface3 px-3 py-1.5 text-sm text-text-disabled transition-colors hover:border-stroke-brand hover:text-text-default"
                      >
                        {preset}
                      </button>
                    ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={send.isPending}
                className="mt-1 inline-flex h-[54px] w-full cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-btn-brand px-6 text-sm font-medium text-text-always-white transition-[filter] hover:brightness-110 disabled:opacity-60"
              >
                {t('submit')}
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
  );
}
