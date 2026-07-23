'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useMutation } from '@/lib/useApi';
import { useErrorText } from '@/lib/useErrorText';
import { api } from '@/lib/api';

type Step = 'email' | 'code' | 'password';

/** Восстановление пароля: почта → код → новый пароль (через /api/auth/recovery). */
export default function RecoveryPage() {
  const t = useTranslations('recovery');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const errorText = useErrorText();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const recovery = useMutation(api.auth.recovery);
  const err = (field: string) =>
    recovery.error && recovery.field === field ? [errorText(recovery.error)] : [];

  const next = async () => {
    if (step === 'email') {
      const res = await recovery.run({ step: 'request', email });
      if (res?.sent) {
        setHint(tAuth('confirm.devCode', { code: res.devCode ?? '' }));
        setStep('code');
      }
      return;
    }
    if (step === 'code') {
      const res = await recovery.run({ step: 'confirm', email, code });
      if (res?.confirmed) setStep('password');
      return;
    }
    const res = await recovery.run({ step: 'reset', email, code, password, password2 });
    if (res?.reset) router.push('/login');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page-bg px-4 py-10">
      <div className="relative w-full max-w-[480px]">
        <button
          type="button"
          onClick={() => router.push('/login')}
          aria-label={t('back')}
          className="absolute -right-16 top-0 hidden h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf2 text-text-default transition-colors hover:bg-comp-surface2-hover lg:inline-flex"
        >
          <Icon name="close" size={20} />
        </button>

        <div className="rounded-3xl bg-surface-page-surf1 p-6 sm:p-8">
          <div className="flex justify-center">
            <Logo />
          </div>
          <h1 className="mt-7 text-center text-xl font-bold text-text-default">{t('title')}</h1>
          <p className="mx-auto mt-3 max-w-80 text-center text-sm leading-relaxed text-text-disabled">
            {t(`steps.${step}`)}
          </p>
          {hint && step === 'code' && (
            <p className="mt-3 text-center text-sm text-text-brand">{hint}</p>
          )}

          <div className="mt-6 flex flex-col gap-4">
            {step === 'email' && (
              <Input
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                errors={err('email')}
                autoComplete="email"
              />
            )}
            {step === 'code' && (
              <Input
                placeholder={t('codePlaceholder')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                errors={err('code')}
                inputMode="numeric"
              />
            )}
            {step === 'password' && (
              <>
                <Input
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  password
                  errors={err('password')}
                  autoComplete="new-password"
                />
                <Input
                  placeholder={t('password2Placeholder')}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  password
                  errors={err('password2')}
                  autoComplete="new-password"
                />
              </>
            )}
          </div>

          <Button className="mt-6 w-full" onClick={next} disabled={recovery.busy}>
            {t('continue')}
          </Button>
        </div>
      </div>
    </main>
  );
}
