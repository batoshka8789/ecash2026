'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';
import { formatPhoneInput } from '@/lib/format';
import { api, ApiError } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';

/** Поле анкеты с плавающим лейблом (появляется, когда есть значение). */
function Field({
  id,
  label,
  value,
  editing = false,
  disabled = false,
  onChange,
  inputMode,
  invalid = false,
  describedBy,
  title,
}: {
  id: string;
  label: string;
  value: string;
  editing?: boolean;
  /** информационные поля из ядра Ecash — недоступны для правки */
  disabled?: boolean;
  onChange?: (v: string) => void;
  inputMode?: 'numeric';
  invalid?: boolean;
  describedBy?: string;
  /** нативная подсказка при наведении — используется для disabled-полей */
  title?: string;
}) {
  return (
    // border всегда (прозрачный в покое) — та же геометрия, что у плашек
    // «О себе»/«Род деятельности» ниже; для редактируемых полей фокус —
    // брендовая обводка по радиусу поля, при ошибке красная держится и в фокусе
    <div
      className={clsx(
        'rounded-xl border bg-surface-page-surf2 px-4 py-2.5 transition-colors',
        invalid ? 'border-negative' : 'border-transparent focus-within:border-stroke-brand',
      )}
    >
      <label
        htmlFor={id}
        className={clsx(
          'block text-[11px] leading-tight text-text-disabled',
          !value && 'sr-only',
        )}
      >
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={label}
        disabled={disabled}
        readOnly={!disabled && !editing}
        inputMode={inputMode}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        title={title}
        className={clsx(
          'w-full bg-transparent text-sm text-text-default outline-none placeholder:text-text-disabled disabled:cursor-default',
          !value && 'py-2',
          !disabled && !editing && 'cursor-default',
        )}
      />
    </div>
  );
}

/**
 * Анкета «Мои данные»: только ФИО (правится, живёт в нашем слое профиля) и
 * номер телефона — он логин аккаунта Ecash, поэтому доступен лишь для
 * чтения, сменить его можно в отделении.
 *
 * Поля франшизной анкеты («о себе», род деятельности, теги) и ИИН отсюда
 * убраны по требованию заказчика: анкета франшизы существует отдельно и
 * собирается своей формой на /franchise.
 */
export function ProfileForm() {
  const t = useTranslations('profile.form');
  const tAddress = useTranslations('profile.address');
  const tCommon = useTranslations('common');
  const { account, invalidate } = useAuth();
  const errorText = useErrorText();
  const uid = useId();
  const errId = `${uid}-error`;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    phoneNumber: '',
  });
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Заполняет форму значениями из аккаунта — и при первой загрузке сессии,
   * и при отмене правок.
   */
  const fillFrom = (a: NonNullable<typeof account>) => {
    setForm({
      // наш слой в приоритете; пока он пуст — подставляем ФИО из ядра Ecash,
      // чтобы у привязанного клиента поля не выглядели пустыми
      firstName: a.profile.firstName || a.firstName,
      lastName: a.profile.lastName || a.lastName,
      middleName: a.profile.middleName || a.middleName,
      phoneNumber: a.phoneNumber ? formatPhoneInput(a.phoneNumber) : '',
    });
  };

  // Подтягиваем данные пользователя, когда сессия загрузилась.
  // Правка состояния во время рендера — штатный способ синхронизации с props.
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  if (account && syncedFor !== account.accountId) {
    setSyncedFor(account.accountId);
    fillFrom(account);
  }

  /**
   * ФИО живёт в нашей анкете, а телефон — логин аккаунта Ecash, и меняется
   * только через ядро (PUT /mobile/account/update-client). Поэтому одно
   * сохранение затрагивает два хранилища; номер трогаем, лишь когда он
   * действительно изменился, чтобы не дёргать ядро на каждой правке имени.
   */
  const save = useMutation({
    mutationFn: async (patch: {
      firstName: string;
      lastName: string;
      middleName: string;
      phoneNumber: string;
    }) => {
      const { phoneNumber, ...profile } = patch;
      const digits = (s: string) => s.replace(/\D/g, '');
      if (account && digits(phoneNumber) && digits(phoneNumber) !== digits(account.phoneNumber)) {
        await api.account.save({ phoneNumber });
      }
      return api.profile.save(profile);
    },
    onSuccess: async () => {
      await invalidate();
      setEditing(false);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    },
  });

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const errField = save.error instanceof ApiError ? save.error.field : undefined;

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const startEdit = () => {
    save.reset();
    setSaved(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (account) fillFrom(account);
    save.reset();
    setEditing(false);
  };

  const commit = () => {
    if (!editing || save.isPending) return;
    save.mutate(form);
  };

  /** Submit формы: Enter в любом поле в режиме редактирования сохраняет анкету. */
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    commit();
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8"
    >
      <div className="flex justify-end gap-2">
        {editing && (
          <button
            type="button"
            onClick={cancelEdit}
            disabled={save.isPending}
            className="inline-flex h-10 cursor-pointer items-center rounded-full border border-stroke-modal px-4 text-sm font-medium text-text-default transition-colors hover:bg-comp-surface1-hover disabled:opacity-60"
          >
            {tCommon('cancel')}
          </button>
        )}
        {/* type ВСЕГДА "button", даже в режиме правки, и сохранение вызывается
            обработчиком вручную. Если менять type на "submit" внутри собственного
            onClick этой же кнопки, браузер выполнит отправку формы как действие
            ПО УМОЛЧАНИЮ того же самого клика: обработчики отрабатывают раньше,
            и к моменту действия по умолчанию кнопка уже submit. Правка
            включалась и в ту же миллисекунду сохранялась и закрывалась —
            снаружи это выглядело как «кнопка нажимается и сразу пропадает».
            Enter в поле по-прежнему сохраняет — через onSubmit формы. */}
        <button
          type="button"
          onClick={editing ? commit : startEdit}
          disabled={save.isPending}
          aria-label={editing ? t('save') : t('edit')}
          title={editing ? t('save') : t('edit')}
          className={clsx(
            'inline-flex cursor-pointer items-center gap-2 transition-colors disabled:opacity-60',
            editing
              ? 'h-10 rounded-full border border-stroke-brand px-4 text-sm font-medium text-text-brand hover:bg-brand-hardsoft'
              : 'h-10 w-10 justify-center rounded-xl bg-surface-page-surf2 text-text-default hover:bg-comp-surface2-hover',
          )}
        >
          {editing && t('save')}
          <Icon name="edit" size={18} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* ФИО правится человеком и живёт в нашем слое профиля. Раньше эти
            поля были намертво disabled «данные из ядра Ecash»: у непривязанного
            клиента (и во всём демо-режиме) ядро отдаёт пустоту, поэтому профиль
            было физически нечем заполнить — правка выглядела нерабочей. */}
        <Field
          id={`${uid}-firstName`}
          label={t('firstName')}
          value={form.firstName}
          editing={editing}
          onChange={set('firstName')}
          invalid={errField === 'firstName'}
          describedBy={errId}
        />
        <Field
          id={`${uid}-lastName`}
          label={t('lastName')}
          value={form.lastName}
          editing={editing}
          onChange={set('lastName')}
          invalid={errField === 'lastName'}
          describedBy={errId}
        />
        <Field
          id={`${uid}-middleName`}
          label={t('middleName')}
          value={form.middleName}
          editing={editing}
          onChange={set('middleName')}
          invalid={errField === 'middleName'}
          describedBy={errId}
        />
      </div>
      {/* Только номер телефона: ИИН, «о себе», род деятельности и теги убраны —
          это поля анкеты на франшизу, в профиле им не место (требование
          заказчика). Данные франшизы собираются своей формой на /franchise.

          Телефон редактируемый: ядро Ecash умеет его менять
          (PUT /mobile/account/update-client), просто эту ручку раньше никто
          не вызывал — отсюда и жалоба «не изменяется номер телефона». */}
      <div className="mt-3">
        <Field
          id={`${uid}-phone`}
          label={t('contact')}
          value={form.phoneNumber}
          editing={editing}
          onChange={(v) => set('phoneNumber')(formatPhoneInput(v))}
          invalid={errField === 'phoneNumber'}
          describedBy={errId}
        />
      </div>
      <p className="mt-2 pl-1 text-xs text-text-disabled">{t('phoneHint')}</p>

      <div aria-live="polite">
        {save.error && (
          <p id={errId} className="mt-4 text-sm text-text-negative">
            {errorText(save.error.message)}
          </p>
        )}
        {saved && <p className="mt-4 text-sm text-text-positive">{tAddress('saved')}</p>}
      </div>
    </form>
  );
}
