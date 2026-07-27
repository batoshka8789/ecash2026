'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useResendTimer } from '@/lib/hooks';
import { useErrorText } from '@/lib/useErrorText';
import { api, ApiError } from '@/lib/api';

type Step = 'phone' | 'code' | 'password' | 'done';

/**
 * Ошибка кода из SMS: сервер проверяет OTP только финальным POST-ом
 * (шаг пароля), поэтому такую ошибку нужно показывать на шаге кода.
 */
function isOtpError(e: unknown): e is ApiError {
  return (
    e instanceof ApiError &&
    (e.field === 'otp' || e.message === 'errors.INVALID_OTP' || e.message === 'errors.OTP_EXPIRED')
  );
}

/**
 * Восстановление пароля по SMS (purpose 2): номер → код → новый пароль.
 * Вёрстка трёхшаговой карточки — из фрейма Recovery passwod макета;
 * upstream отзывает все сессии аккаунта после сброса.
 */
export function RecoveryFlow() {
  const t = useTranslations('recovery');
  const router = useRouter();
  const errorText = useErrorText();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendLeft, setResendLeft] = useResendTimer();
  /** код ошибки OTP, показываемый на шаге «код» после отката с шага пароля */
  const [otpStepError, setOtpStepError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => api.auth.otp.send(phone.trim(), 2),
    onSuccess: (res) => {
      setResendLeft(res.resendAfterSeconds);
      setDevCode(res.devCode ?? null);
      setStep('code');
    },
  });

  const reset = useMutation({
    mutationFn: () =>
      api.auth.otp.resetPassword({
        phoneNumber: phone.trim(),
        otp,
        newPassword: password,
        newPassword2: password2,
      }),
    onSuccess: () => setStep('done'),
    onError: (e) => {
      // Код проверяется только этим запросом: при неверном/истёкшем OTP
      // возвращаем на шаг кода — иначе ошибка поля otp останется невидимой.
      if (isOtpError(e)) {
        setOtpStepError(e.message);
        setOtp('');
        setStep('code');
      }
    },
  });

  const active = step === 'password' ? reset : send;
  const activeError = active.error instanceof ApiError ? active.error : null;
  const err = (field: string) =>
    activeError && activeError.field === field ? [errorText(activeError.message)] : [];
  const generalError = activeError && !activeError.field ? errorText(activeError.message) : null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'phone') send.mutate();
    else if (step === 'code') {
      if (otp.length === 6) setStep('password');
    } else if (step === 'password') reset.mutate();
    else router.push('/login');
  };

  const busy = send.isPending || reset.isPending;

  return (
    <div className="relative w-full max-w-[480px]">
      <button
        type="button"
        onClick={() => router.push('/login')}
        aria-label={t('back')}
        className="absolute right-0 top-0 z-10 inline-flex h-11 w-11 -translate-y-12 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf2 text-text-default transition-colors hover:bg-comp-surface2-hover md:fixed md:right-10 md:top-10 md:translate-y-0"
      >
        <Icon name="close" size={20} />
      </button>

      <form
        onSubmit={onSubmit}
        className="rounded-[20px] bg-surface-page-surf1 px-5 py-10 md:px-10"
        noValidate
      >
        <div className="flex justify-center">
          <Logo />
        </div>

        <h1 className="mt-9 text-center text-xl font-medium leading-[1.4] text-text-default">
          {t('title')}
        </h1>

        {step === 'phone' && (
          <>
            <p className="mt-3 text-center text-lg leading-[1.2] text-text-disabled">
              {t('phoneStep')}
            </p>
            <Input
              className="mt-9"
              placeholder={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              errors={err('phoneNumber')}
              autoComplete="tel"
              inputMode="tel"
            />
          </>
        )}

        {step === 'code' && (
          <>
            <p className="mt-3 text-center text-lg leading-[1.2] text-text-disabled">
              {t('steps.code')}
            </p>
            <Input
              className="mt-9"
              placeholder={t('codePlaceholder')}
              value={otp}
              onChange={(e) => {
                setOtpStepError(null);
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              errors={otpStepError ? [errorText(otpStepError)] : err('otp')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
            {devCode && (
              <p className="mt-2 text-center text-xs font-medium leading-[1.3] text-text-brand">
                {t('devCode', { code: devCode })}
              </p>
            )}
            <div className="mt-4 text-center text-sm font-medium leading-5" aria-live="polite">
              {resendLeft > 0 ? (
                <span className="text-text-disabled">{t('resendIn', { sec: resendLeft })}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOtpStepError(null);
                    send.mutate();
                  }}
                  disabled={send.isPending}
                  className="cursor-pointer text-text-brand transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {t('resend')}
                </button>
              )}
            </div>
          </>
        )}

        {step === 'password' && (
          <>
            <p className="mt-3 text-center text-lg leading-[1.2] text-text-disabled">
              {t('steps.password')}
            </p>
            <div className="mt-9 flex flex-col gap-2">
              <Input
                placeholder={t('newPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                password
                errors={err('newPassword')}
                autoComplete="new-password"
              />
              <Input
                placeholder={t('newPassword2')}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                password
                errors={err('newPassword2')}
                autoComplete="new-password"
              />
            </div>
          </>
        )}

        {step === 'done' && (
          <p role="status" className="mt-3 text-center text-lg leading-[1.2] text-text-positive">
            {t('done')}
          </p>
        )}

        {generalError && (
          <p
            role="alert"
            className="mt-4 text-center text-xs font-medium leading-[1.3] text-text-negative"
          >
            {generalError}
          </p>
        )}

        <Button
          type="submit"
          className="mt-4 w-full"
          disabled={busy || (step === 'code' && otp.length !== 6)}
        >
          {step === 'done' ? t('toLogin') : t('continue')}
        </Button>

        {(step === 'code' || step === 'password') && (
          <button
            type="button"
            onClick={() => {
              if (step === 'code') setOtpStepError(null);
              setStep(step === 'code' ? 'phone' : 'code');
            }}
            className="mt-4 w-full cursor-pointer text-center text-sm font-medium leading-5 text-text-disabled transition-colors hover:text-text-default"
          >
            {t('back')}
          </button>
        )}
      </form>
    </div>
  );
}
