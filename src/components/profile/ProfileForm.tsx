'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';
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
    <div className="rounded-xl bg-surface-page-surf2 px-4 py-2.5">
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

const tagKeys = ['entrepreneur', 'investor', 'director'] as const;

/**
 * Анкета «Мои данные». ФИО, ИИН и телефон приходят из ядрового клиента Ecash
 * (привязка происходит у кассира) — здесь они только для чтения. Наш слой
 * (о себе, занятость, теги) редактируется и сохраняется в профиль.
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
  const [form, setForm] = useState({ about: '', occupation: '' });
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Заполняет форму значениями из аккаунта — и при первой загрузке сессии,
   * и при отмене правок. `tags` защищаем от не-массива: анкета не должна
   * ронять страницу из-за кривых данных (нормализация есть и на сервере).
   */
  const fillFrom = (a: NonNullable<typeof account>) => {
    setForm({ about: a.profile.about, occupation: a.profile.occupation });
    setTags(Array.isArray(a.profile.tags) ? a.profile.tags : []);
  };

  // Подтягиваем данные пользователя, когда сессия загрузилась.
  // Правка состояния во время рендера — штатный способ синхронизации с props.
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  if (account && syncedFor !== account.accountId) {
    setSyncedFor(account.accountId);
    fillFrom(account);
  }

  const save = useMutation({
    mutationFn: (patch: { about: string; occupation: string; tags: string[] }) =>
      api.profile.save(patch),
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

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));

  /** Неизвестный серверный тег показываем как есть — без «сырых» ключей перевода. */
  const tagLabel = (tag: string) =>
    (tagKeys as readonly string[]).includes(tag) ? t(`tags.${tag}`) : tag;

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

  /** Submit формы: Enter в любом поле в режиме редактирования сохраняет анкету. */
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || save.isPending) return;
    save.mutate({ ...form, tags });
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
        <button
          type={editing ? 'submit' : 'button'}
          onClick={editing ? undefined : startEdit}
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
        <Field
          id={`${uid}-firstName`}
          label={t('firstName')}
          value={account?.firstName ?? ''}
          disabled
          title={t('readonlyHint')}
        />
        <Field
          id={`${uid}-lastName`}
          label={t('lastName')}
          value={account?.lastName ?? ''}
          disabled
          title={t('readonlyHint')}
        />
        <Field
          id={`${uid}-middleName`}
          label={t('middleName')}
          value={account?.middleName ?? ''}
          disabled
          title={t('readonlyHint')}
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id={`${uid}-iin`}
          label={t('iin')}
          value={account?.iin ?? ''}
          disabled
          inputMode="numeric"
          title={t('readonlyHint')}
        />
        <Field
          id={`${uid}-phone`}
          label={t('contact')}
          value={account?.phoneNumber ?? ''}
          disabled
          title={t('readonlyHint')}
        />
      </div>
      <p className="mt-2 pl-1 text-xs text-text-disabled">{t('readonlyHint')}</p>

      <div className="mt-3 rounded-xl bg-surface-page-surf2 px-4 py-3">
        <label htmlFor={`${uid}-about`} className="sr-only">
          {t('about')}
        </label>
        <textarea
          id={`${uid}-about`}
          value={form.about}
          onChange={(e) => set('about')(e.target.value)}
          readOnly={!editing}
          placeholder={t('about')}
          rows={3}
          maxLength={1000}
          aria-invalid={errField === 'about' || undefined}
          aria-describedby={errField === 'about' ? errId : undefined}
          className="w-full resize-none bg-transparent text-sm text-text-default outline-none placeholder:text-text-disabled"
        />
      </div>

      <div className="mt-3 rounded-xl bg-surface-page-surf2 px-4 py-3">
        {tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-surface-modal-surf1 px-3 py-1 text-xs text-text-default"
              >
                {tagLabel(tag)}
                {editing && (
                  <button
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-label={t('removeTag')}
                    className="cursor-pointer text-text-disabled hover:text-text-default"
                  >
                    <Icon name="close" size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        <label htmlFor={`${uid}-occupation`} className="sr-only">
          {t('occupation')}
        </label>
        <input
          id={`${uid}-occupation`}
          value={form.occupation}
          onChange={(e) => set('occupation')(e.target.value)}
          readOnly={!editing}
          placeholder={t('occupation')}
          maxLength={120}
          aria-invalid={errField === 'occupation' || undefined}
          aria-describedby={errField === 'occupation' ? errId : undefined}
          className="w-full bg-transparent text-sm text-text-default outline-none placeholder:text-text-disabled"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tagKeys.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              disabled={!editing}
              onClick={() => toggleTag(tag)}
              className={clsx(
                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                selected
                  ? 'bg-surface-modal-surf1 text-text-default'
                  : 'bg-surface-page-surf2 text-text-disabled',
                editing && 'cursor-pointer hover:bg-comp-surface2-hover',
              )}
            >
              {t(`tags.${tag}`)}
            </button>
          );
        })}
      </div>

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
