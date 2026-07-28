'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useErrorText } from '@/lib/useErrorText';
import { useResendTimer } from '@/lib/hooks';
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
 * Вёрстка карточки — модалки макета «Подтверждение кода» (890:34113,
 * 480×416) и «Установите пароль» (890:35314, 480×406) из секции
 * Recovery passwod; upstream отзывает все сессии аккаунта после сброса.
 */
export function RecoveryFlow() {
  const t = useTranslations('recovery');
  // подписи повторной отправки общие с модалкой входа
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const errorText = useErrorText();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  /** код ошибки OTP, показываемый на шаге «код» после отката с шага пароля */
  const [otpStepError, setOtpStepError] = useState<string | null>(null);
  /** Обратный отсчёт до повторной отправки кода. */
  const [resendLeft, setResendLeft] = useResendTimer();

  const send = useMutation({
    mutationFn: () => api.auth.otp.send(phone.trim(), 2),
    onSuccess: (res) => {
      setDevCode(res.devCode ?? null);
      setStep('code');
      // сервер сам говорит, через сколько разрешит следующую отправку
      setResendLeft(res.resendAfterSeconds);
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
  /** описание под заголовком есть у всех шагов, кроме установки пароля */
  const description =
    step === 'phone'
      ? t('phoneStep')
      : step === 'code'
        ? t('steps.code')
        : step === 'done'
          ? t('done')
          : null;

  return (
    <div className="relative w-full max-w-[360px] md:max-w-[480px]">
      {/* Кнопка возврата 44×44 — как в модалке входа: с 768 в правом верхнем
          углу экрана (отступы 40 по макету), ниже — внутри модалки по её
          боковому полю 20, иначе с экрана нечем уйти. */}
      <button
        type="button"
        onClick={() => router.push('/login')}
        aria-label={t('back')}
        className="absolute right-5 top-5 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf2 text-text-default transition-colors hover:bg-comp-surface2-hover md:fixed md:right-10 md:top-10 md:bg-surface-page-surf1 md:hover:bg-comp-surface1-hover"
      >
        <Icon name="close" size={20} />
      </button>

      {/* Модалка: колонка с зазором 36, padding 40 (20 по бокам до 768),
          r20; на 360 растянута во весь экран без скруглений */}
      <form
        onSubmit={onSubmit}
        className="relative flex w-full flex-col gap-9 rounded-[20px] bg-surface-page-surf1 px-5 py-10 max-[361px]:min-h-screen max-[361px]:justify-center max-[361px]:rounded-none md:px-10"
        noValidate
      >
        <div className="flex justify-center">
          <Logo />
        </div>

        {/* txt: заголовок и описание с зазором 12 (890:34101) */}
        <div className="flex flex-col gap-3">
          <h1 className="text-center font-rubik text-xl font-medium leading-[1.4] text-text-default">
            {t('title')}
          </h1>
          {description && (
            <p
              role={step === 'done' ? 'status' : undefined}
              className={
                step === 'done'
                  ? 'text-center font-rubik text-lg leading-[1.2] text-text-positive'
                  : 'text-center font-rubik text-lg leading-[1.2] text-text-disabled'
              }
            >
              {description}
            </p>
          )}
        </div>

        {/* Frame 1437255194: поля и кнопка с зазором 16 */}
        <div className="flex flex-col gap-4">
          {step === 'phone' && (
            <Input
              placeholder={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              errors={err('phoneNumber')}
              autoComplete="tel"
              inputMode="tel"
            />
          )}

          {step === 'code' && (
            <Input
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
          )}

          {/* Как и в модалке входа: без повторной отправки шаг кода —
              тупик, если SMS не дошло. В макете этого контрола нет. */}
          {step === 'code' &&
            (resendLeft > 0 ? (
              <p className="text-center text-sm font-medium leading-5 text-text-disabled">
                {tAuth('resendIn', { sec: resendLeft })}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => send.mutate()}
                disabled={send.isPending}
                className="cursor-pointer text-center text-sm font-medium leading-5 text-text-brand transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tAuth('resend')}
              </button>
            ))}

          {step === 'password' && (
            /* Frame 1437255276 400×116: два поля с зазором 8 */
            <div className="flex flex-col gap-2">
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
          )}

          {generalError && (
            <p
              role="alert"
              className="text-center text-xs font-medium leading-[1.3] text-text-negative"
            >
              {generalError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={busy || (step === 'code' && otp.length !== 6)}
          >
            {step === 'done' ? t('toLogin') : t('continue')}
          </Button>
        </div>

        {/* Демо-стенд отдаёт код в ответе; подсказка лежит в нижнем поле
            карточки и не влияет на её высоту */}
        {devCode && step === 'code' && (
          <p className="absolute inset-x-5 bottom-3 text-center text-xs font-medium leading-[1.3] text-text-brand md:inset-x-10">
            {t('devCode', { code: devCode })}
          </p>
        )}
      </form>
    </div>
  );
}
