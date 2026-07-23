'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PillTabs } from '@/components/ui/PillTabs';
import { useAuth } from '@/lib/auth';
import { useMutation } from '@/lib/useApi';
import { useErrorText } from '@/lib/useErrorText';
import { api } from '@/lib/api';
import { SocialButtons } from './SocialButtons';

type Tab = 'login' | 'signup';
type Step = 'form' | 'confirm';

/**
 * Модалка авторизации: Вход / Регистрация / Подтверждение почты.
 * Валидацию и сессию выполняет мок-бэкенд (/api/auth/*).
 */
export function AuthCard({ initialTab = 'login' }: { initialTab?: Tab }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { setUser } = useAuth();
  const errorText = useErrorText();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const login = useMutation(api.auth.login);
  const signup = useMutation(api.auth.signup);
  const verify = useMutation(api.auth.verify);

  const active = tab === 'login' ? login : step === 'confirm' ? verify : signup;
  const err = (field: string) =>
    active.error && active.field === field ? [errorText(active.error)] : [];

  const submitForm = async () => {
    if (tab === 'login') {
      const res = await login.run(email, password);
      if (res) {
        setUser(res.user);
        // после входа «/» отдаёт приложение, а не лендинг
        router.replace('/');
        router.refresh();
      }
      return;
    }
    const res = await signup.run(email, password, password2);
    if (res) {
      // Бэкенд мок — письма не уходят, поэтому код показываем подсказкой.
      setHint(t('confirm.devCode', { code: res.devCode }));
      setStep('confirm');
    }
  };

  const submitCode = async () => {
    const res = await verify.run(email, code, phone);
    if (res) {
      setUser(res.user);
      // регистрация завершена — сразу в приложение
      router.replace('/');
      router.refresh();
    }
  };

  return (
    <div className="relative w-full max-w-[480px]">
      <button
        type="button"
        onClick={() => router.push('/')}
        aria-label={t('close')}
        className="absolute -right-16 top-0 hidden h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf2 text-text-default transition-colors hover:bg-comp-surface2-hover lg:inline-flex"
      >
        <Icon name="close" size={20} />
      </button>

      <div className="rounded-3xl bg-surface-page-surf1 p-6 sm:p-8">
        <div className="flex justify-center">
          <Logo />
        </div>

        {step === 'form' ? (
          <>
            <PillTabs
              className="mt-7"
              value={tab}
              onChange={(v) => {
                setTab(v);
                login.reset();
                signup.reset();
              }}
              tabs={[
                { value: 'login', label: t('tabs.login') },
                { value: 'signup', label: t('tabs.signup') },
              ]}
            />

            <div className="mt-6 flex flex-col gap-4">
              <Input
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                errors={err('login').concat(err('email'))}
                autoComplete="email"
              />
              <Input
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                password
                errors={err('password')}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
              {tab === 'signup' && (
                <Input
                  placeholder={t('password2Placeholder')}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  password
                  errors={err('password2')}
                  autoComplete="new-password"
                />
              )}
              {tab === 'login' && (
                <button
                  type="button"
                  onClick={() => router.push('/recovery')}
                  className="cursor-pointer self-start text-sm text-text-brand transition-opacity hover:opacity-80"
                >
                  {t('forgot')}
                </button>
              )}
            </div>

            <Button className="mt-6 w-full" onClick={submitForm} disabled={active.busy}>
              {t('continue')}
            </Button>

            <div className="my-6 border-t border-divider-additional" />
            <SocialButtons />
          </>
        ) : (
          <>
            <h1 className="mt-7 text-center text-xl font-bold text-text-default">
              {t('confirm.title')}
            </h1>
            <p className="mx-auto mt-3 max-w-80 text-center text-sm leading-relaxed text-text-disabled">
              {t('confirm.text', { email })}
            </p>
            {hint && <p className="mt-3 text-center text-sm text-text-brand">{hint}</p>}

            <Input
              className="mt-6"
              placeholder={t('confirm.codePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              errors={err('code')}
              inputMode="numeric"
            />
            <Input
              className="mt-3"
              placeholder={t('confirm.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />

            <Button className="mt-6 w-full" onClick={submitCode} disabled={verify.busy}>
              {t('confirm.submit')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
