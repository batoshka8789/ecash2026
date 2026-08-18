'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatPhoneInput } from '@/lib/format';
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
    (e.field === 'otp' ||
      e.message === 'errors.INVALID_OTP' ||
      e.message === 'errors.OTP_EXPIRED')
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
  const [resendLeft, setResendLeft] = useResendTimer();
  /** код ошибки OTP, показываемый на шаге «код» после отката с шага пароля */
  const [otpStepError, setOtpStepError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => api.auth.otp.send(phone.trim(), 2),
    onSuccess: (res) => {
      setResendLeft(res.resendAfterSeconds);
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
        className="absolute right-0 top-0 z-10 inline-flex h-10 w-10 -translate-y-12 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf2 text-text-default transition-colors hover:bg-comp-surface2-hover lg:right-[-64px] lg:top-0 lg:h-11 lg:w-11 lg:translate-y-0"
      >
        <Icon name="close" size={20} />
      </button>

      <form onSubmit={onSubmit} className="rounded-3xl bg-surface-page-surf1 p-6 sm:p-8" noValidate>
        <div className="flex justify-center">
          <Logo />
        </div>

        <h1 className="mt-7 text-center text-xl font-bold text-text-default">{t('title')}</h1>

        {step === 'phone' && (
          <>
            <p className="mx-auto mt-3 max-w-80 text-center text-sm leading-relaxed text-text-disabled">
              {t('phoneStep')}
            </p>
            {/* Сброс пароля на стороне ядра Ecash сейчас отвечает успехом, но
                пароль не меняет (HANDOFF 9.2, у них в работе). Честно
                предупреждаем ДО прохождения шагов и даём рабочий путь —
                вход по SMS-коду, который пароль не использует. Убрать блок,
                когда Ecash подтвердят починку сброса. */}
            <div className="mx-auto mt-4 max-w-96 rounded-2xl bg-surface-page-surf2 p-4 text-sm leading-relaxed text-text-default">
              {t('resetUnstable')}{' '}
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="cursor-pointer font-medium text-text-brand transition-opacity hover:opacity-80"
              >
                {t('resetUnstableAction')}
              </button>
            </div>
            <Input
              className="mt-6"
              label={t('phonePlaceholder')}
              placeholder={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              errors={err('phoneNumber')}
              autoComplete="tel"
              inputMode="tel"
              maxLength={18}
            />
          </>
        )}

        {step === 'code' && (
          <>
            <p className="mx-auto mt-3 max-w-80 text-center text-sm leading-relaxed text-text-disabled">
              {t('steps.code')}
            </p>
            <Input
              className="mt-6"
              label={t('codePlaceholder')}
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
            <div className="mt-3 text-center text-sm" aria-live="polite">
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
            <p className="mx-auto mt-3 max-w-80 text-center text-sm leading-relaxed text-text-disabled">
              {t('steps.password')}
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <Input
                label={t('newPassword')}
                placeholder={t('newPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                password
                errors={err('newPassword')}
                autoComplete="new-password"
              />
              <Input
                label={t('newPassword2')}
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
          <p
            role="status"
            className="mx-auto mt-4 max-w-80 text-center text-sm leading-relaxed text-text-positive"
          >
            {t('done')}
          </p>
        )}

        {generalError && (
          <p role="alert" className="mt-4 text-center text-sm text-text-negative">
            {generalError}
          </p>
        )}

        <Button
          type="submit"
          className="mt-6 w-full"
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
            className="mt-4 w-full cursor-pointer text-center text-sm text-text-disabled transition-colors hover:text-text-default"
          >
            {t('back')}
          </button>
        )}
      </form>
    </div>
  );
}
