'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';
import { useMutation } from '@/lib/useApi';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';

/** Поле анкеты с плавающим лейблом (появляется, когда есть значение). */
function Field({
  label,
  value,
  onChange,
  editing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
}) {
  return (
    <label className="block rounded-xl bg-surface-page-surf2 px-4 py-2.5">
      {value && <span className="block text-[11px] leading-tight text-text-disabled">{label}</span>}
      <input
        value={value}
        placeholder={label}
        readOnly={!editing}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'w-full bg-transparent text-sm text-text-default outline-none placeholder:text-text-disabled',
          !value && 'py-2',
          !editing && 'cursor-default',
        )}
      />
    </label>
  );
}

const tagKeys = ['entrepreneur', 'investor', 'director'] as const;

/** Анкета «Мои данные»: просмотр, редактирование и сохранение через мок-бэкенд. */
export function ProfileForm() {
  const t = useTranslations('profile.form');
  const { user, setUser } = useAuth();
  const save = useMutation(api.profile.save);
  const errorText = useErrorText();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    iin: '',
    phone: '',
    about: '',
    occupation: '',
  });
  const [tags, setTags] = useState<string[]>([]);

  // Подтягиваем данные пользователя, когда сессия загрузилась.
  // Правка состояния во время рендера — штатный способ синхронизации с props.
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  if (user && syncedFor !== user.id) {
    setSyncedFor(user.id);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      iin: user.iin,
      phone: user.phone,
      about: user.about,
      occupation: user.occupation,
    });
    setTags(user.tags);
  }

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));

  const submit = async () => {
    if (!editing) {
      setEditing(true);
      return;
    }
    const res = await save.run({ ...form, tags });
    if (res) {
      setUser(res.user);
      setEditing(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={save.busy}
          aria-label={editing ? t('save') : t('edit')}
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
        <Field label={t('firstName')} value={form.firstName} onChange={set('firstName')} editing={editing} />
        <Field label={t('lastName')} value={form.lastName} onChange={set('lastName')} editing={editing} />
        <Field label={t('middleName')} value={form.middleName} onChange={set('middleName')} editing={editing} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('iin')} value={form.iin} onChange={set('iin')} editing={editing} />
        <Field label={t('contact')} value={form.phone} onChange={set('phone')} editing={editing} />
      </div>

      <textarea
        value={form.about}
        onChange={(e) => set('about')(e.target.value)}
        readOnly={!editing}
        placeholder={t('about')}
        rows={3}
        className="mt-3 w-full resize-none rounded-xl bg-surface-page-surf2 px-4 py-3 text-sm text-text-default outline-none placeholder:text-text-disabled"
      />

      <div className="mt-3 rounded-xl bg-surface-page-surf2 px-4 py-3">
        {tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-surface-modal-surf1 px-3 py-1 text-xs text-text-default"
              >
                {t(`tags.${tag}`)}
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
        <input
          value={form.occupation}
          onChange={(e) => set('occupation')(e.target.value)}
          readOnly={!editing}
          placeholder={t('occupation')}
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

      {save.error && <p className="mt-4 text-sm text-text-negative">{errorText(save.error)}</p>}
    </div>
  );
}
