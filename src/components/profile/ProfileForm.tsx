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
  className,
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
  className?: string;
}) {
  return (
    /* «input» [1810:161124]: 66 при padding 12/16 — лейбл 12/14, зазор 6,
       значение 16/20 (12+14+6+20+12+2 бордера = 66) */
    <div
      className={clsx(
        'flex min-h-[66px] flex-col justify-center rounded-[20px] border border-stroke-surface1 bg-surface-page-surf2 px-4 py-3',
        className,
      )}
    >
      <label
        htmlFor={id}
        className={clsx(
          // одна строка: в макете поле фиксировано по 66, длинный лейбл его не тянет
          'block truncate text-xs font-medium leading-[14px] text-text-disabled',
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
          'w-full bg-transparent text-base font-semibold leading-5 text-text-default outline-none placeholder:font-medium placeholder:text-text-disabled disabled:cursor-default',
          value && 'mt-1.5',
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
   * Заполняет форму значениями из аккаунта при первой загрузке сессии.
   * `tags` защищаем от не-массива: анкета не должна ронять страницу
   * из-за кривых данных (нормализация есть и на сервере).
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

  /**
   * Submit формы: в просмотре открывает правку, в правке сохраняет анкету
   * (Enter в любом поле работает так же).
   *
   * Единственная кнопка карточки всегда submit: если переключать ей type по
   * ходу клика, React успевает отрисовать «submit» до того, как браузер
   * выполнит действие кнопки, и один клик по «Изменить» заодно отправлял форму.
   */
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    if (!editing) {
      startEdit();
      return;
    }
    save.mutate({ ...form, tags });
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:p-8"
    >
      <div className="flex justify-end">
        {/* «a-button-main» [1810:153590] 50×50 (46×46 на ≤480), в правке —
            141×50 с подписью белым и обводкой #F15A25 [1810:161132] */}
        <button
          type="submit"
          disabled={save.isPending}
          aria-label={editing ? t('save') : t('edit')}
          title={editing ? t('save') : t('edit')}
          className={clsx(
            'inline-flex h-[46px] cursor-pointer items-center gap-2 rounded-[20px] transition-colors disabled:opacity-60 md:h-[50px]',
            editing
              ? 'border border-stroke-brand bg-surface-page-surf2 pl-6 pr-3 text-sm font-medium leading-5 text-text-always-white hover:bg-brand-hardsoft'
              : 'w-[46px] justify-center border border-stroke-surface1 text-text-default hover:bg-comp-surface1-hover md:w-[50px]',
          )}
        >
          {editing && t('save')}
          <Icon name="edit" size={20} />
        </button>
      </div>

      {/* ФИО: 360 — [Имя | Фамилия] и «Отчество» во всю ширину, ≥480 — три в ряд */}
      <div className="mt-6 grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
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
          className="col-span-2 min-[480px]:col-span-1"
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
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

      {/* «Component 3» [1810:153599] 772×100: padding 22/16, текст 16/500 */}
      <div className="mt-2 rounded-[20px] border border-stroke-surface1 bg-surface-page-surf2 px-4 py-[22px]">
        <label htmlFor={`${uid}-about`} className="sr-only">
          {t('about')}
        </label>
        <textarea
          id={`${uid}-about`}
          value={form.about}
          onChange={(e) => set('about')(e.target.value)}
          readOnly={!editing}
          placeholder={t('about')}
          rows={2}
          maxLength={1000}
          aria-invalid={errField === 'about' || undefined}
          aria-describedby={errField === 'about' ? errId : undefined}
          className="block h-[54px] w-full resize-none bg-transparent text-base font-medium leading-5 text-text-default outline-none placeholder:text-text-disabled"
        />
      </div>

      {/* Просмотр — «Component 2» [1810:153600] 66 при padding 22/16 и тексте
          16/500; правка — «Chips input» [1810:161131]: поле padding 8/16 с
          выбранными чипами и подписью 12/700 lh14.4, под ним ряд чипов 27. */}
      <div
        className={clsx(
          'mt-2 flex min-h-[66px] flex-col justify-center rounded-[20px] border border-stroke-surface1 bg-surface-page-surf2 px-4',
          editing ? 'py-2' : 'py-[22px]',
        )}
      >
        {editing && tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-5 items-center gap-2 rounded-[30px] bg-surface-modal-surf1 px-2 text-xs font-bold leading-[18px] text-text-default"
              >
                {tagLabel(tag)}
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-label={t('removeTag')}
                  className="cursor-pointer text-text-disabled hover:text-text-default"
                >
                  <Icon name="close" size={12} />
                </button>
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
          className={clsx(
            'w-full bg-transparent text-text-default outline-none placeholder:text-text-disabled',
            editing
              ? 'text-xs font-bold leading-[14.4px]'
              : 'text-base font-medium leading-5 placeholder:font-medium',
          )}
        />
      </div>

      {/* Ряд чипов есть только в режиме правки: «Frame 1437254913» [1810:161722]
          — 27 в высоту, padding 4/12, обводка 2px, подпись 14/500 #EEEEEE */}
      {editing && (
        <div className="mt-1 flex flex-wrap gap-1">
          {tagKeys.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="h-[27px] cursor-pointer rounded-[30px] border-2 border-stroke-surface1 bg-surface-page-surf2 px-3 text-sm font-medium leading-[15px] text-text-default transition-colors hover:bg-comp-surface2-hover"
            >
              {t(`tags.${tag}`)}
            </button>
          ))}
        </div>
      )}

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
