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
import { GoogleIcon, TelegramIcon } from '@/components/ui/BrandIcons';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/useErrorText';
import { useResendTimer } from '@/lib/hooks';
import { passwordSchema } from '@/shared/schemas';
import { api, ApiError } from '@/lib/api';

type Tab = 'login' | 'signup';

/** Поля первого экрана регистрации — их ошибки видны только на нём. */
const REG_FORM_FIELDS = ['login', 'phoneNumber', 'password', 'password2'];

/** Ошибка поля логина: оно видно только на первом шаге входа. */
function isLoginFieldError(e: unknown): e is ApiError {
  return e instanceof ApiError && (e.field === 'login' || e.field === 'phoneNumber');
}

/**
 * Авторизация по контракту Ecash Mobile: вход «логин → пароль»,
 * регистрация «логин + пароль + повтор → код подтверждения».
 *
 * Вёрстка — модалки макета: 883:33240 (вход, 480×600) из секции Log in,
 * 885:33840 (регистрация, «Sign up step1 (User data)» 480×690) и 890:34113
 * («Sign up step2 (mes gmail)», подтверждение кода, 480×416) из секции
 * Sign up. Вход в макете разбит на два экрана с одним полем — «log in step1
 * (name)» и «log in step2 (password)».
 *
 * Порядок экранов регистрации — из секции Sign up (1222:69959): сначала все
 * данные (три поля), потом одно поле кода. Контракту это не противоречит:
 * otp.send уходит по «Продолжить» с первого экрана, а register — вместе с
 * кодом со второго, пароли к тому моменту уже собраны в состоянии.
 *
 * Плейсхолдер поля входа — «Номер телефона или эл.почта», как в макете
 * (883:33233): loginValueSchema произвольную строку пропускает, нормализует
 * логин апстрим. Клавиатуру не форсируем — с почтой inputMode="tel" мешал бы.
 * Регистрация пока остаётся телефонной: otp.send и register требуют
 * phoneNumber и шлют SMS, поэтому почта здесь сработает только когда апстрим
 * научится слать код на неё.
 */
export function AuthCard({ initialTab = 'login' }: { initialTab?: Tab }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { invalidate } = useAuth();
  const errorText = useErrorText();

  const [tab, setTab] = useState<Tab>(initialTab);
  // вход: логин → пароль (в макете это два отдельных экрана)
  const [loginStep, setLoginStep] = useState<'login' | 'password'>('login');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  // регистрация: данные (логин + пароли) → код подтверждения
  const [regStep, setRegStep] = useState<'form' | 'code'>('form');
  const [regLogin, setRegLogin] = useState('');
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
    mutationFn: () => api.auth.otp.send(regLogin.trim(), 0),
    onSuccess: (res) => {
      setDevCode(res.devCode ?? null);
      setRegStep('code');
      // сервер сам говорит, через сколько разрешит следующую отправку
      setResendLeft(res.resendAfterSeconds);
    },
  });

  const registerMut = useMutation({
    mutationFn: () => api.auth.register({ phoneNumber: regLogin.trim(), otp, password, password2 }),
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
      // где полей уже нет. Проверяем теми же схемами до отправки SMS.
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
  /** заголовок и текст экрана подтверждения — по тому, что ввёл пользователь */
  const byEmail = regLogin.includes('@');

  return (
    <div className="relative w-full max-w-[360px] md:max-w-[480px]">
      {/* Кнопка закрытия 44×44. С 768 макет выносит её за модалку, в правый
          верхний угол экрана с отступами 40 (1195:61487 на 1920, 1784:153736
          на 768). На 480 и 360 её в макете нет вовсе, но без неё экран входа —
          ловушка: уйти с него нечем. Поэтому там кладём кнопку внутрь модалки
          по её же боковому полю 20; логотип по центру, налезать не на что.
          Подложка — на ступень светлее того, что под кнопкой: surf1 на фоне
          страницы, surf2 на фоне модалки. */}
      <button
        type="button"
        onClick={() => router.push('/')}
        aria-label={t('close')}
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

        {withTabs ? (
          <>
            {/* Вкладки и форма — колонка 400×256 с зазором 44 (890:34371) */}
            <div className="flex flex-col gap-11">
              <PillTabs
                value={tab}
                onChange={(v) => {
                  setTab(v);
                  setLoginStep('login');
                  setOtp('');
                  setDevCode(null);
                  // Состояние пароля общее у входа и регистрации, а после
                  // перестановки шагов поле пароля есть на ПЕРВОМ экране обеих
                  // вкладок. Без сброса пароль, набранный во «Входе», молча
                  // подставлялся в «Регистрацию» (и наоборот): пользователь
                  // видел точки, которых не вводил, а пустой «Повторите
                  // пароль» давал «Пароли не совпадают» на чужое значение.
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
                /* 400×158: поле + ссылка (зазор 4), затем кнопка через 12 */
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    {loginStep === 'login' ? (
                      <Input
                        placeholder={t('loginLabel')}
                        value={loginValue}
                        onChange={(e) => setLoginValue(e.target.value)}
                        errors={err('login').concat(err('phoneNumber'))}
                        autoComplete="username"
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
                    {/* «a-button-main» 103×34, padding 8/0. В макете подпись
                        #FFFFFF, но макет нарисован только тёмным: в светлой
                        теме это белое по белой модалке. Берём text/default —
                        #EEEEEE в тёмной (та же подпись на глаз) и #3F3F3F
                        в светлой. */}
                    <button
                      type="button"
                      onClick={() => router.push('/recovery')}
                      className="flex h-[34px] w-fit cursor-pointer items-center rounded-[20px] text-sm font-medium leading-5 text-text-default transition-opacity hover:opacity-80"
                    >
                      {t('forgot')}
                    </button>
                  </div>

                  {generalError && <GeneralError text={generalError} />}
                  <Button type="submit" className="w-full" disabled={busy}>
                    {t('continue')}
                  </Button>
                </div>
              ) : (
                /* Frame 1437255052 400×248: поля 400×54 с зазором 8
                   (Frame 1437255272 400×178), затем кнопка через 16 */
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    {/*
                      Подпись как в макете (883:33233) — «Номер телефона или
                      эл.почта», по прямому указанию владельца. Оговорка:
                      регистрация шлёт SMS (otp.send с purpose 0), поэтому
                      почта здесь сработает только если апстрим научится
                      слать код на неё. inputMode="tel" поэтому убран —
                      цифровая клавиатура мешала бы вводить адрес.
                    */}
                    <Input
                      placeholder={t('loginLabel')}
                      value={regLogin}
                      onChange={(e) => {
                        setFormError(null);
                        setRegLogin(e.target.value);
                      }}
                      errors={err('login').concat(err('phoneNumber'))}
                      autoComplete="username"
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
                  <Button type="submit" className="w-full" disabled={busy}>
                    {t('continue')}
                  </Button>
                </div>
              )}
            </div>

            {/* Line 21: 1px, в раскладке макета высота 0. Цвет — divider/hole:
                в тёмной теме это ровно #1A1A1A из макета, в светлой #E0E0E0,
                иначе линия сливалась бы с белой модалкой. */}
            <div aria-hidden className="-mt-px h-px bg-divider-hole" />

            {/* btns 400×116 (877:33288) */}
            <div className="flex flex-col gap-2">
              <SocialButton icon={<TelegramIcon />} label={t('withTelegram')} />
              <SocialButton icon={<GoogleIcon />} label={t('withGoogle')} />
            </div>
          </>
        ) : (
          <>
            {/* txt 400×100: заголовок и описание с зазором 12 (890:34101).
                Заголовков в макете два — «Подтверждение электронной почты»
                и «Подтверждение номера телефона»; какой показать, решаем по
                введённому логину: «@» — почта, иначе телефон. */}
            <div className="flex flex-col gap-3">
              <ModalTitle>{byEmail ? t('confirm.emailTitle') : t('confirm.phoneTitle')}</ModalTitle>
              <ModalText>
                {byEmail
                  ? t('confirm.emailText', { login: regLogin.trim() })
                  : t('confirm.phoneText', { login: regLogin.trim() })}
              </ModalText>
            </div>

            {/* Frame 1437255194 400×124: поле и кнопка с зазором 16 */}
            <div className="flex flex-col gap-4">
              <Input
                placeholder={byEmail ? t('confirm.emailCode') : t('confirm.phoneCode')}
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
              <Button type="submit" className="w-full" disabled={busy || otp.length !== 6}>
                {t('register')}
              </Button>
              {/* Кнопки повторной отправки в макете нет, но без неё экран кода —
                  тупик: не дошло SMS, и пройти дальше нечем. Набрана
                  типографикой подписей макета (Roboto Medium 14/20). */}
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

/** Заголовок модалки: Rubik Medium 20/1.4 #EEEEEE по центру. */
function ModalTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-center font-rubik text-xl font-medium leading-[1.4] text-text-default">
      {children}
    </h1>
  );
}

/** Описание под заголовком: Rubik Regular 18/1.2 #6B6B6B по центру. */
function ModalText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center font-rubik text-lg leading-[1.2] text-text-disabled">{children}</p>
  );
}

function GeneralError({ text }: { text: string }) {
  return (
    <p role="alert" className="text-center text-xs font-medium leading-[1.3] text-text-negative">
      {text}
    </p>
  );
}

/**
 * Соц-вход «a-button-main» 400×54 (847:36810): фон surface/surf2, r20,
 * иконка 20×20 у левого края (отступ 16 + 1px обводки), подпись по центру
 * кнопки — Roboto Medium 14/20.
 *
 * Подпись в макете #FFFFFF, но макета светлой темы нет, а surface/surf2 в ней
 * #F5F3F2 — белым по белому подпись пропадала. Ставим text/default: в тёмной
 * теме #EEEEEE (от белого не отличить), в светлой #3F3F3F.
 */
function SocialButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="relative flex h-[54px] w-full cursor-pointer items-center justify-center rounded-[20px] bg-surface-page-surf2 text-sm font-medium leading-5 text-text-default transition-colors hover:bg-comp-surface2-hover"
    >
      <span className="absolute left-[17px] flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}
