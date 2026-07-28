'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useRouter } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PillTabs } from '@/components/ui/PillTabs';
import { GoogleIcon, TelegramIcon } from '@/components/ui/BrandIcons';
import { useAuth } from '@/lib/auth';
import { formatLoginInput, formatPhoneInput } from '@/lib/format';
import { useResendTimer } from '@/lib/hooks';
import { useErrorText } from '@/lib/useErrorText';
import { passwordSchema } from '@/shared/schemas';
import { api, ApiError } from '@/lib/api';

type Tab = 'login' | 'signup';

/** Поля первого экрана регистрации — их ошибки видны только на нём. */
const REG_FORM_FIELDS = ['login', 'phoneNumber', 'password', 'password2'];

/**
 * Соц-вход включается флагом сборки. По умолчанию выключен: в контракте
 * Ecash Mobile Api нет ни одного OAuth-метода (ни Telegram, ни Google), и
 * нажимать на кнопку, которая ничего не делает, пользователь не должен.
 * Когда апстрим отдаст эндпоинты — NEXT_PUBLIC_SOCIAL_AUTH=1 вернёт кнопки
 * в рабочее состояние, останется повесить обработчики.
 */
const SOCIAL_AUTH_ENABLED = process.env.NEXT_PUBLIC_SOCIAL_AUTH === '1';

/** Подпись-объяснение под парой соц-кнопок; на неё ссылаются обе кнопки. */
const SOCIAL_HINT_ID = 'social-auth-hint';

/** Ошибка поля логина: оно видно только на первом шаге входа. */
function isLoginFieldError(e: unknown): e is ApiError {
  return e instanceof ApiError && (e.field === 'login' || e.field === 'phoneNumber');
}

/**
 * Авторизация по контракту Ecash Mobile (api-spec/ecash-mobile-api.json):
 * вход POST /mobile/auth/login «логин → пароль», регистрация
 * «телефон + пароль + повтор → код из SMS» = POST /mobile/otp/send (purpose 0)
 * и POST /mobile/auth/register. Наши /api/auth/* — прокси к этим методам.
 *
 * Рисунок карточки перенесён из ecash-beta: модалка r20 с колонкой gap 36 и
 * padding 40 (20 по бокам до 768), на 360 — во весь экран без скруглений;
 * вкладки r20, поля 54×r20, кнопка 54×r20, под формой линия и соц-входы.
 *
 * Отличия от беты — по контракту самого Ecash:
 *   · подпись поля входа осталась «Номер телефона или ИИН» и с маской
 *     телефона: loginValueSchema принимает и то, и другое, а почту апстрим
 *     на входе не знает;
 *   · регистрация телефонная (registerBody.phoneNumber = phoneSchema),
 *     поэтому экран кода всегда набран текстами про SMS.
 */
export function AuthCard({
  initialTab = 'login',
  onClose,
  onSuccess,
}: {
  initialTab?: Tab;
  /** есть только в модалке — крестик закрывает её вместо перехода на «/» */
  onClose?: () => void;
  /** есть только в модалке — вызывающий сам решает, что делать после входа
   *  (продолжить прерванное действие), вместо перехода на «/» */
  onSuccess?: () => void;
}) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { invalidate } = useAuth();
  const errorText = useErrorText();

  const [tab, setTab] = useState<Tab>(initialTab);
  // вход: логин → пароль (в макете это два отдельных экрана)
  const [loginStep, setLoginStep] = useState<'login' | 'password'>('login');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  // регистрация: данные (телефон + пароли) → код из SMS
  const [regStep, setRegStep] = useState<'form' | 'code'>('form');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password2, setPassword2] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  /** Обратный отсчёт до повторной отправки кода. */
  const [resendLeft, setResendLeft] = useResendTimer();
  /**
   * Ошибка полей первого экрана регистрации: своя проверка паролей до отправки
   * SMS и ответ сервера, прилетевший уже на экране кода, — там этих полей нет.
   */
  const [formError, setFormError] = useState<{ field: string; message: string } | null>(null);

  const finish = async () => {
    await invalidate();
    if (onSuccess) {
      onSuccess();
      return;
    }
    // после входа «/» отдаёт приложение, а не лендинг
    router.replace('/');
    router.refresh();
  };

  const loginMut = useMutation({
    mutationFn: () => api.auth.login(loginValue.trim(), password),
    onSuccess: finish,
    // поле логина есть только на первом шаге — иначе ошибка останется невидимой
    onError: (e) => {
      if (isLoginFieldError(e)) setLoginStep('login');
    },
  });

  const sendMut = useMutation({
    mutationFn: () => api.auth.otp.send(phone.trim(), 0),
    onSuccess: (res) => {
      setDevCode(res.devCode ?? null);
      setRegStep('code');
      // сервер сам говорит, через сколько разрешит следующую отправку
      setResendLeft(res.resendAfterSeconds);
    },
  });

  const registerMut = useMutation({
    mutationFn: () =>
      api.auth.register({ phoneNumber: phone.trim(), otp, password, password2 }),
    onSuccess: finish,
    onError: (e) => {
      // Пароли уходят вместе с кодом, но полей для них на экране кода нет:
      // если сервер забракует именно их, возвращаем на первый экран.
      if (!(e instanceof ApiError) || !e.field || !REG_FORM_FIELDS.includes(e.field)) return;
      setFormError({ field: e.field, message: e.message });
      setRegStep('form');
    },
  });

  /**
   * На экране кода ошибку может дать и регистрация, и повторная отправка —
   * берём ту, что случилась (регистрация приоритетнее: она свежее).
   */
  const screenMuts =
    tab === 'login' ? [loginMut] : regStep === 'form' ? [sendMut] : [registerMut, sendMut];
  const activeError =
    screenMuts.map((m) => m.error).find((e): e is ApiError => e instanceof ApiError) ?? null;
  const err = (field: string) => {
    if (formError?.field === field) return [errorText(formError.message)];
    return activeError && activeError.field === field ? [errorText(activeError.message)] : [];
  };
  /** ошибка без привязки к полю — показываем под формой */
  const generalError = activeError && !activeError.field ? errorText(activeError.message) : null;

  const resetErrors = () => {
    loginMut.reset();
    sendMut.reset();
    registerMut.reset();
    setFormError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'login') {
      if (loginStep === 'login') {
        if (loginValue.trim()) setLoginStep('password');
        return;
      }
      loginMut.mutate();
      return;
    }
    if (regStep === 'form') {
      // Пароль сервер проверит только финальным POST-ом — со второго экрана,
      // где полей уже нет. Проверяем той же схемой до отправки SMS.
      const pw = passwordSchema.safeParse(password);
      if (!pw.success) {
        setFormError({ field: 'password', message: pw.error.issues[0].message });
        return;
      }
      if (password !== password2) {
        setFormError({ field: 'password2', message: 'errors.passwordMatch' });
        return;
      }
      setFormError(null);
      sendMut.mutate();
      return;
    }
    registerMut.mutate();
  };

  const busy = loginMut.isPending || sendMut.isPending || registerMut.isPending;
  /** экраны с вкладками — единственные, где под формой есть соц-входы */
  const withTabs = tab === 'login' || regStep === 'form';

  return (
    <div className="relative w-full max-w-[360px] md:max-w-[480px]">
      {/* Кнопка закрытия 44×44. На странице входа с 768 она уходит за модалку,
          в правый верхний угол экрана (отступы 40); в модалке остаётся внутри
          карточки — там за её пределами лежит подложка, клик по которой уже
          закрывает окно. Подложка кнопки — на ступень светлее того, что под
          ней: surf2 на фоне модалки, surf1 на фоне страницы. */}
      <button
        type="button"
        onClick={onClose ?? (() => router.push('/'))}
        aria-label={t('close')}
        className={
          onClose
            ? 'absolute right-5 top-5 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf2 text-text-default transition-colors hover:bg-comp-surface2-hover'
            : 'absolute right-5 top-5 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf2 text-text-default transition-colors hover:bg-comp-surface2-hover md:fixed md:right-10 md:top-10 md:bg-surface-page-surf1 md:hover:bg-comp-surface1-hover'
        }
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

        {withTabs ? (
          <>
            {/* Вкладки и форма — колонка с зазором 44 */}
            <div className="flex flex-col gap-11">
              <PillTabs
                variant="r20"
                value={tab}
                onChange={(v) => {
                  setTab(v);
                  setLoginStep('login');
                  setOtp('');
                  setDevCode(null);
                  // Состояние пароля общее у входа и регистрации, а поле пароля
                  // есть на ПЕРВОМ экране обеих вкладок. Без сброса пароль,
                  // набранный во «Входе», молча подставлялся бы в «Регистрацию».
                  setPassword('');
                  setPassword2('');
                  resetErrors();
                }}
                tabs={[
                  { value: 'login', label: t('tabs.login') },
                  { value: 'signup', label: t('tabs.signup') },
                ]}
              />

              {tab === 'login' ? (
                /* поле + ссылка (зазор 4), затем кнопка через 12 */
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    {loginStep === 'login' ? (
                      <Input
                        placeholder={t('loginLabel')}
                        value={loginValue}
                        onChange={(e) => setLoginValue(formatLoginInput(e.target.value))}
                        errors={err('login').concat(err('phoneNumber'))}
                        autoComplete="username"
                        inputMode="tel"
                      />
                    ) : (
                      <Input
                        placeholder={t('passwordPlaceholder')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        password
                        errors={err('password')}
                        autoComplete="current-password"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => router.push('/recovery')}
                      className="flex h-[34px] w-fit cursor-pointer items-center rounded-[20px] text-sm font-medium leading-5 text-text-default transition-opacity hover:opacity-80"
                    >
                      {t('forgot')}
                    </button>
                  </div>

                  {generalError && <GeneralError text={generalError} />}
                  <Button type="submit" size="auth" className="w-full" disabled={busy}>
                    {t('continue')}
                  </Button>
                </div>
              ) : (
                /* поля 54 с зазором 8, затем кнопка через 16 */
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    {/* Регистрация телефонная: otp.send шлёт SMS, а register
                        принимает phoneNumber — поэтому здесь маска номера,
                        а не свободный логин, как на входе. */}
                    <Input
                      placeholder={t('phoneLabel')}
                      value={phone}
                      onChange={(e) => {
                        setFormError(null);
                        setPhone(formatPhoneInput(e.target.value));
                      }}
                      errors={err('login').concat(err('phoneNumber'))}
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={18}
                    />
                    <Input
                      placeholder={t('passwordPlaceholder')}
                      value={password}
                      onChange={(e) => {
                        setFormError(null);
                        setPassword(e.target.value);
                      }}
                      password
                      errors={err('password')}
                      autoComplete="new-password"
                    />
                    <Input
                      placeholder={t('password2Placeholder')}
                      value={password2}
                      onChange={(e) => {
                        setFormError(null);
                        setPassword2(e.target.value);
                      }}
                      password
                      errors={err('password2')}
                      autoComplete="new-password"
                    />
                  </div>

                  {generalError && <GeneralError text={generalError} />}
                  <Button type="submit" size="auth" className="w-full" disabled={busy}>
                    {t('continue')}
                  </Button>
                </div>
              )}
            </div>

            {/* Линия-разделитель 1px, в раскладке высоты не занимает */}
            <div aria-hidden className="-mt-px h-px bg-divider-hole" />

            <div className="flex flex-col gap-2">
              <SocialButton
                icon={<TelegramIcon />}
                label={t('withTelegram')}
                hintId={SOCIAL_AUTH_ENABLED ? undefined : SOCIAL_HINT_ID}
              />
              <SocialButton
                icon={<GoogleIcon />}
                label={t('withGoogle')}
                hintId={SOCIAL_AUTH_ENABLED ? undefined : SOCIAL_HINT_ID}
              />
              {!SOCIAL_AUTH_ENABLED && (
                <p
                  id={SOCIAL_HINT_ID}
                  className="text-center text-xs font-medium leading-[1.3] text-text-disabled"
                >
                  {t('socialUnavailable')}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* заголовок и описание с зазором 12 */}
            <div className="flex flex-col gap-3">
              <ModalTitle>{t('otpTitle')}</ModalTitle>
              <ModalText>{t('otpSent', { phone: phone.trim() })}</ModalText>
            </div>

            {/* поле и кнопка с зазором 16 */}
            <div className="flex flex-col gap-4">
              <Input
                placeholder={t('otpPlaceholder')}
                value={otp}
                onChange={(e) => {
                  // код проверяет только register — его же ошибку и гасим
                  registerMut.reset();
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                }}
                errors={err('otp')}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
              {generalError && <GeneralError text={generalError} />}
              <Button
                type="submit"
                size="auth"
                className="w-full"
                disabled={busy || otp.length !== 6}
              >
                {t('register')}
              </Button>
              {/* Без повторной отправки экран кода — тупик: не дошло SMS,
                  и пройти дальше нечем. */}
              {resendLeft > 0 ? (
                <p className="text-center text-sm font-medium leading-5 text-text-disabled">
                  {t('resendIn', { sec: resendLeft })}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    registerMut.reset();
                    setOtp('');
                    sendMut.mutate();
                  }}
                  disabled={sendMut.isPending}
                  className="cursor-pointer text-center text-sm font-medium leading-5 text-text-brand transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('resend')}
                </button>
              )}
              <BackButton
                onClick={() => {
                  registerMut.reset();
                  setRegStep('form');
                }}
              />
            </div>
          </>
        )}

        {/* Демо-стенд отдаёт код в ответе; подсказка лежит в нижнем поле
            карточки и не влияет на её высоту */}
        {devCode && regStep === 'code' && (
          <p className="absolute inset-x-5 bottom-3 text-center text-xs font-medium leading-[1.3] text-text-brand md:inset-x-10">
            {t('devCodeHint', { code: devCode })}
          </p>
        )}
      </form>
    </div>
  );
}

/**
 * Возврат с экрана кода к полям регистрации: без него пользователь,
 * ошибшийся в номере, застревал бы на «введите код». Подпись «Назад»
 * живёт в словаре восстановления пароля.
 */
function BackButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('recovery');
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer text-center text-sm font-medium leading-5 text-text-disabled transition-colors hover:text-text-default"
    >
      {t('back')}
    </button>
  );
}

/** Заголовок модалки: 20/1.4 по центру. */
function ModalTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-center text-xl font-medium leading-[1.4] text-text-default">{children}</h1>
  );
}

/** Описание под заголовком: 18/1.2 по центру. */
function ModalText({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-lg leading-[1.2] text-text-disabled">{children}</p>;
}

function GeneralError({ text }: { text: string }) {
  return (
    <p role="alert" className="text-center text-xs font-medium leading-[1.3] text-text-negative">
      {text}
    </p>
  );
}

/**
 * Соц-вход 54×r20: фон surface/surf2, иконка 20×20 у левого края,
 * подпись по центру кнопки.
 *
 * Пока провайдера нет (SOCIAL_AUTH_ENABLED=false) кнопка приходит с hintId:
 * она гасится, курсор становится «нельзя», а причина написана подписью под
 * парой кнопок и привязана к обеим через aria-describedby — иначе кнопка
 * молча не реагировала бы на клик, и это выглядело бы поломкой.
 */
function SocialButton({
  icon,
  label,
  hintId,
}: {
  icon: React.ReactNode;
  label: string;
  hintId?: string;
}) {
  const disabled = Boolean(hintId);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-describedby={hintId}
      className={clsx(
        'relative flex h-[54px] w-full items-center justify-center rounded-[20px] bg-surface-page-surf2 text-sm font-medium leading-5 text-text-default transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:bg-comp-surface2-hover',
      )}
    >
      <span className="absolute left-[17px] flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}
