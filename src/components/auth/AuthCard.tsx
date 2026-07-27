'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PillTabs } from '@/components/ui/PillTabs';
import { useAuth } from '@/lib/auth';
import { useResendTimer } from '@/lib/hooks';
import { useErrorText } from '@/lib/useErrorText';
import { api, ApiError } from '@/lib/api';

type Tab = 'login' | 'signup';

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
 * Авторизация по контракту Ecash Mobile: телефон/ИИН + пароль,
 * вход по SMS-коду, регистрация «номер → SMS-код → пароль».
 * Вёрстка и состояния карточки — из макета (фрейм Log in 1784:153588),
 * e-mail-полей в реальном API не существует.
 */
export function AuthCard({ initialTab = 'login' }: { initialTab?: Tab }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { invalidate } = useAuth();
  const errorText = useErrorText();

  const [tab, setTab] = useState<Tab>(initialTab);
  // вход
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  // регистрация: phone → code → password
  const [regStep, setRegStep] = useState<'phone' | 'code' | 'password'>('phone');
  const [phone, setPhone] = useState('');
  const [iin, setIin] = useState('');
  const [otp, setOtp] = useState('');
  const [password2, setPassword2] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendLeft, setResendLeft] = useResendTimer();
  /** код ошибки OTP, показываемый на шаге «код» после отката с шага пароля */
  const [otpStepError, setOtpStepError] = useState<string | null>(null);
  /** клиентская ошибка ИИН — сервер проверил бы его только на финальном шаге */
  const [iinError, setIinError] = useState(false);

  const finish = async () => {
    await invalidate();
    // после входа «/» отдаёт приложение, а не лендинг
    router.replace('/');
    router.refresh();
  };

  const loginMut = useMutation({
    mutationFn: () =>
      loginMode === 'password'
        ? api.auth.login(loginValue.trim(), password)
        : api.auth.otp.login(loginValue.trim(), otp),
    onSuccess: finish,
  });

  const sendMut = useMutation({
    mutationFn: (purpose: 0 | 1) =>
      api.auth.otp.send(tab === 'signup' ? phone.trim() : loginValue.trim(), purpose),
    onSuccess: (res) => {
      setResendLeft(res.resendAfterSeconds);
      setDevCode(res.devCode ?? null);
      if (tab === 'signup') setRegStep('code');
    },
  });

  const registerMut = useMutation({
    mutationFn: () =>
      api.auth.register({
        phoneNumber: phone.trim(),
        otp,
        password,
        password2,
        iin: iin.trim() || undefined,
      }),
    onSuccess: finish,
    onError: (e) => {
      // Код проверяется только этим запросом: при неверном/истёкшем OTP
      // возвращаем на шаг кода — иначе ошибка поля otp останется невидимой.
      if (isOtpError(e)) {
        setOtpStepError(e.message);
        setOtp('');
        setRegStep('code');
      }
    },
  });

  const active = tab === 'login' ? loginMut : regStep === 'password' ? registerMut : sendMut;
  const activeError = active.error instanceof ApiError ? active.error : null;
  const err = (field: string) =>
    activeError && activeError.field === field ? [errorText(activeError.message)] : [];
  /** ошибка без привязки к полю — показываем под формой */
  const generalError = activeError && !activeError.field ? errorText(activeError.message) : null;

  const resetErrors = () => {
    loginMut.reset();
    sendMut.reset();
    registerMut.reset();
    setOtpStepError(null);
    setIinError(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'login') {
      if (loginMode === 'otp' && !sendMut.data) {
        sendMut.mutate(1);
        return;
      }
      loginMut.mutate();
      return;
    }
    if (regStep === 'phone') {
      // ИИН необязателен, но если заполнен — ровно 12 цифр (iinSchema);
      // сервер проверит его только финальным POST-ом, где поля уже нет.
      if (iin.trim() && iin.trim().length !== 12) {
        setIinError(true);
        return;
      }
      sendMut.mutate(0);
    } else if (regStep === 'code') {
      if (otp.length === 6) setRegStep('password');
    } else registerMut.mutate();
  };

  const busy = loginMut.isPending || sendMut.isPending || registerMut.isPending;

  return (
    <div className="relative w-full max-w-[480px]">
      <button
        type="button"
        onClick={() => router.push('/')}
        aria-label={t('close')}
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

        {tab === 'login' || regStep === 'phone' ? (
          <>
            <PillTabs
              className="mt-9"
              value={tab}
              onChange={(v) => {
                setTab(v);
                setOtp('');
                setDevCode(null);
                resetErrors();
              }}
              tabs={[
                { value: 'login', label: t('tabs.login') },
                { value: 'signup', label: t('tabs.signup') },
              ]}
            />

            {tab === 'login' ? (
              <div className="mt-11 flex flex-col gap-2">
                <Input
                  placeholder={t('loginLabel')}
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  errors={err('login').concat(err('phoneNumber'))}
                  autoComplete="username"
                  inputMode="tel"
                />
                {loginMode === 'password' ? (
                  <>
                    <Input
                      placeholder={t('passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      password
                      errors={err('password')}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => router.push('/recovery')}
                      className="cursor-pointer self-start py-2 text-sm font-medium leading-5 text-text-brand transition-opacity hover:opacity-80"
                    >
                      {t('forgot')}
                    </button>
                  </>
                ) : sendMut.data ? (
                  <OtpField
                    value={otp}
                    onChange={setOtp}
                    errors={err('otp')}
                    devCode={devCode}
                    resendLeft={resendLeft}
                    onResend={() => sendMut.mutate(1)}
                    resending={sendMut.isPending}
                  />
                ) : null}
              </div>
            ) : (
              <div className="mt-11 flex flex-col gap-2">
                <Input
                  placeholder={t('phoneLabel')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  errors={err('phoneNumber')}
                  autoComplete="tel"
                  inputMode="tel"
                />
                <Input
                  placeholder={t('iinOptional')}
                  value={iin}
                  onChange={(e) => {
                    setIinError(false);
                    setIin(e.target.value.replace(/\D/g, '').slice(0, 12));
                  }}
                  errors={iinError ? [errorText('errors.iinInvalid')] : err('iin')}
                  inputMode="numeric"
                  maxLength={12}
                />
              </div>
            )}

            {generalError && (
              <p
                role="alert"
                className="mt-4 text-center text-xs font-medium leading-[1.3] text-text-negative"
              >
                {generalError}
              </p>
            )}

            <Button type="submit" className="mt-4 w-full" disabled={busy}>
              {t('continue')}
            </Button>

            {tab === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setLoginMode((m) => (m === 'password' ? 'otp' : 'password'));
                  setOtp('');
                  resetErrors();
                }}
                className="mt-4 w-full cursor-pointer text-center text-sm font-medium leading-5 text-text-brand transition-opacity hover:opacity-80"
              >
                {loginMode === 'password' ? t('byOtp') : t('byPassword')}
              </button>
            )}
          </>
        ) : regStep === 'code' ? (
          <>
            <h1 className="mt-9 text-center text-xl font-medium leading-[1.4] text-text-default">
              {t('otpTitle')}
            </h1>
            <p className="mt-3 text-center text-lg leading-[1.2] text-text-disabled">
              {t('otpSent', { phone })}
            </p>

            <OtpField
              className="mt-9"
              value={otp}
              onChange={(v) => {
                setOtpStepError(null);
                setOtp(v);
              }}
              errors={otpStepError ? [errorText(otpStepError)] : err('otp')}
              devCode={devCode}
              resendLeft={resendLeft}
              onResend={() => {
                setOtpStepError(null);
                sendMut.mutate(0);
              }}
              resending={sendMut.isPending}
            />

            {generalError && (
              <p
                role="alert"
                className="mt-4 text-center text-xs font-medium leading-[1.3] text-text-negative"
              >
                {generalError}
              </p>
            )}

            <Button type="submit" className="mt-4 w-full" disabled={busy || otp.length !== 6}>
              {t('continue')}
            </Button>
            <BackLink
              onClick={() => {
                setOtpStepError(null);
                setRegStep('phone');
              }}
            />
          </>
        ) : (
          <>
            <h1 className="mt-9 text-center text-xl font-medium leading-[1.4] text-text-default">
              {t('completeTitle')}
            </h1>
            <div className="mt-9 flex flex-col gap-2">
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
              <PasswordRules password={password} />
            </div>

            {generalError && (
              <p
                role="alert"
                className="mt-4 text-center text-xs font-medium leading-[1.3] text-text-negative"
              >
                {generalError}
              </p>
            )}

            <Button type="submit" className="mt-4 w-full" disabled={busy}>
              {t('register')}
            </Button>
            <BackLink onClick={() => setRegStep('code')} />
          </>
        )}
      </form>
    </div>
  );
}

/** Поле SMS-кода с таймером повторной отправки и подсказкой демо-режима. */
function OtpField({
  value,
  onChange,
  errors,
  devCode,
  resendLeft,
  onResend,
  resending,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  errors: string[];
  devCode: string | null;
  resendLeft: number;
  onResend: () => void;
  resending: boolean;
  className?: string;
}) {
  const t = useTranslations('auth');
  return (
    <div className={className}>
      <Input
        placeholder={t('otpPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        errors={errors}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
      />
      {devCode && (
        <p className="mt-2 text-center text-xs font-medium leading-[1.3] text-text-brand">
          {t('devCodeHint', { code: devCode })}
        </p>
      )}
      <div className="mt-4 text-center text-sm font-medium leading-5" aria-live="polite">
        {resendLeft > 0 ? (
          <span className="text-text-disabled">{t('resendIn', { sec: resendLeft })}</span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="cursor-pointer text-text-brand transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {t('resend')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Живые подсказки требований к паролю — тексты из макета. */
function PasswordRules({ password }: { password: string }) {
  const t = useTranslations('errors');
  const rules = [
    { ok: password.length >= 8, label: t('passwordMin') },
    { ok: /\d/.test(password), label: t('passwordDigit') },
  ];
  return (
    <ul className="flex flex-col gap-0.5 text-xs font-medium leading-[1.3]">
      {rules.map((r) => (
        <li key={r.label} className={r.ok ? 'text-text-positive' : 'text-text-disabled'}>
          {r.ok ? '✓' : '•'} {r.label}
        </li>
      ))}
    </ul>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  const t = useTranslations('recovery');
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full cursor-pointer text-center text-sm font-medium leading-5 text-text-disabled transition-colors hover:text-text-default"
    >
      {t('back')}
    </button>
  );
}
