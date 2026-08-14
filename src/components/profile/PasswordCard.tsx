'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { changePasswordBody } from '@/shared/schemas';
import { useErrorText } from '@/lib/useErrorText';

/**
 * Смена пароля из профиля — для тех, кто текущий пароль помнит.
 *
 * Второй путь, «Забыли пароль» по SMS, остаётся на /recovery: он для тех, кто
 * пароль не помнит вовсе. Ссылка на него есть и здесь — человек, начавший
 * менять пароль и осознавший, что текущего не знает, не должен искать выход
 * сам.
 *
 * Форма проверяет ввод той же схемой, что и сервер (`changePasswordBody`),
 * чтобы не платить сетевым запросом за опечатку; авторитетная проверка всё
 * равно на сервере, а текущий пароль знает только ядро Ecash.
 */
export function PasswordCard() {
  const t = useTranslations('profile.password');
  const errorText = useErrorText();
  const router = useRouter();
  const panelId = useId();

  /**
   * По умолчанию свёрнуто. Смена пароля — редкое действие, а тремя полями во
   * всю ширину блок перевешивал анкету профиля, ради которой на страницу и
   * заходят. В свёрнутом виде это одна строка вровень с остальными карточками.
   */
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [formError, setFormError] = useState<{ field: string; message: string } | null>(null);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.account.changePassword({
        currentPassword: current,
        newPassword: next,
        newPassword2: repeat,
      }),
    onSuccess: () => {
      // поля чистим сразу: оставлять пароли в DOM после успеха незачем
      setCurrent('');
      setNext('');
      setRepeat('');
      setDone(true);
    },
  });

  /** Ошибки поля: своя проверка формы или ответ сервера с указанием поля. */
  const fieldErrors = (name: string): string[] => {
    if (formError?.field === name) return [errorText(formError.message)];
    if (mutation.error instanceof ApiError && mutation.error.field === name) {
      return [errorText(mutation.error.message)];
    }
    return [];
  };

  /** Ошибка без привязки к полю — показываем общей строкой. */
  const generalError =
    mutation.error instanceof ApiError && !mutation.error.field
      ? errorText(mutation.error.message)
      : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setDone(false);
    const parsed = changePasswordBody.safeParse({
      currentPassword: current,
      newPassword: next,
      newPassword2: repeat,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setFormError({ field: String(issue.path[0] ?? ''), message: issue.message });
      return;
    }
    setFormError(null);
    mutation.mutate();
  };

  /** Свернули — стираем введённое: держать пароли в DOM скрытой формы незачем. */
  const toggle = () => {
    setOpen((v) => {
      if (v) {
        setCurrent('');
        setNext('');
        setRepeat('');
        setFormError(null);
        setDone(false);
        mutation.reset();
      }
      return !v;
    });
  };

  return (
    /* Отступы и скругление — ровно как у соседних карточек профиля: проверено
       вычисленными стилями (32px / 24px на десктопе), а не по классам. */
    <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
      >
        <span className="text-base font-bold text-text-default">{t('title')}</span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex shrink-0 text-text-disabled"
        >
          <Icon name="arrow_drop_down" size={24} />
        </motion.span>
      </button>

      {!open && done && (
        <p aria-live="polite" className="mt-2 text-sm text-text-positive">
          {t('done')}
        </p>
      )}

      {open && (
        <form id={panelId} onSubmit={submit} noValidate className="anim-panel-in mt-4">
          <p className="text-sm leading-5 text-text-disabled">{t('hint')}</p>

          <div className="mt-4 flex flex-col gap-3">
            <Input
              label={t('current')}
              placeholder={t('current')}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              password
              errors={fieldErrors('currentPassword')}
              autoComplete="current-password"
            />
            <Input
              label={t('new')}
              placeholder={t('new')}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              password
              errors={fieldErrors('newPassword')}
              autoComplete="new-password"
            />
            <Input
              label={t('repeat')}
              placeholder={t('repeat')}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              password
              errors={fieldErrors('newPassword2')}
              autoComplete="new-password"
            />
          </div>

          <div aria-live="polite">
            {generalError && <p className="mt-3 text-sm text-text-negative">{generalError}</p>}
            {done && <p className="mt-3 text-sm text-text-positive">{t('done')}</p>}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={mutation.isPending}>
              {t('submit')}
            </Button>
            <button
              type="button"
              onClick={() => router.push('/recovery')}
              className="cursor-pointer text-sm font-medium text-text-default transition-opacity hover:opacity-80"
            >
              {t('forgot')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
