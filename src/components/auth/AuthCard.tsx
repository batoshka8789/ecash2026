'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Link, useRouter } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PillTabs } from '@/components/ui/PillTabs';
import { GoogleIcon, TelegramIcon } from '@/components/ui/BrandIcons';
import { useAuth } from '@/lib/auth';
import { formatPhoneInput } from '@/lib/format';
import { useResendTimer } from '@/lib/hooks';
import { useErrorText } from '@/lib/useErrorText';
import {
  consentServerSnapshot,
  readConsent,
  subscribeConsent,
  writeConsent,
} from '@/lib/legal/consent-storage';
import { ConsentModal } from '@/components/legal/ConsentModal';
import { fullNameSchema, passwordSchema } from '@/shared/schemas';
import { api, ApiError } from '@/lib/api';

type Tab = 'login' | 'signup';

/** Поля первого экрана регистрации — их ошибки видны только на нём. */
const REG_FORM_FIELDS = ['login', 'phoneNumber', 'fullName', 'password', 'password2'];

/**
 * Кнопки соц-входа есть в макете, но нажать их нельзя: в контракте Ecash
 * Mobile Api нет ни одного OAuth-метода — ни Telegram, ни Google. Поэтому
 * они всегда неактивны и объясняют это подписью.
 *
 * Раньше здесь стоял флаг NEXT_PUBLIC_SOCIAL_AUTH, включавший кнопки. Это
 * была ловушка: обработчика у них нет и не было, так что включение флага
 * давало две активные кнопки, которые молча ничего не делают. Флаг убран —
 * чтобы включить соц-вход, нужны эндпоинты у Ecash и обработчики здесь,
 * а не переменная окружения.
 */

/** Подпись-объяснение под парой соц-кнопок; на неё ссылаются обе кнопки. */
const SOCIAL_HINT_ID = 'social-auth-hint';

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
 *   · поле входа — ТОЛЬКО телефон, с живой маской «+7 (705) 123 45 67».
 *     Ядро принимает и ИИН, но в интерфейсе его нет намеренно: телефон и
 *     ИИН неразличимы на середине набора (ИИН родившегося в 70-е–80-е
 *     начинается на 7/8, как код страны), и попытки совместить их в одном
 *     поле стоили двух регрессий — сперва поле пропускало буквы, потом
 *     телефон остался без форматирования. Кому нужен ИИН — вход по
 *     SMS-коду рядом. Серверная схема ИИН по-прежнему принимает: она
 *     страхует прямые запросы, а не рисует поле;
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
  // вход: логин и пароль одним экраном
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  // регистрация: данные (телефон + пароли) → код из SMS
  const [regStep, setRegStep] = useState<'form' | 'code'>('form');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password2, setPassword2] = useState('');
  const [fullName, setFullName] = useState('');
  /** Обратный отсчёт до повторной отправки кода. */
  const [resendLeft, setResendLeft] = useResendTimer();
  /**
   * Вход по SMS-коду (purpose 1) — вторая ветка вкладки «Вход»: телефон →
   * код, пароль не нужен. Поле телефона общее с регистрацией, а таймер
   * повтора свой: иначе обратный отсчёт одного потока показывался бы
   * в другом после переключения вкладок.
   */
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [loginOtpStep, setLoginOtpStep] = useState<'phone' | 'code'>('phone');
  const [otpResendLeft, setOtpResendLeft] = useResendTimer();
  /**
   * Согласие на обработку персональных данных — обязательное условие
   * регистрации (Закон РК «О персональных данных и их защите»). Проверяется
   * ДО отправки SMS: код уходит на реальный номер и стоит денег, а без
   * согласия регистрация всё равно невозможна.
   *
   * Дать его можно двумя путями, и оба сходятся в одной галочке:
   *
   *  · галочкой прямо здесь;
   *  · кнопкой «Принимаю и продолжаю» в окне с текстом (ConsentModal) —
   *    оно открывается поверх формы, поля не теряются, и галочка встаёт
   *    сама: возвращаться и искать её не нужно.
   *
   * Плюс согласие, данное на отдельной странице /legal/consent, тоже
   * подхватывается — через localStorage, в том числе из соседней вкладки.
   *
   * `override` — осознанный выбор человека здесь: null означает «слушаем
   * хранилище», true/false — «решено галочкой». Без него снятая вручную
   * галочка тут же вставала бы обратно.
   */
  const acceptedInDoc = useSyncExternalStore(
    subscribeConsent,
    readConsent,
    consentServerSnapshot,
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const consent = override ?? acceptedInDoc;
  /** показать «без согласия нельзя» — только после попытки отправки */
  const [consentError, setConsentError] = useState(false);
  /** текст согласия окном поверх формы */
  const [consentDocOpen, setConsentDocOpen] = useState(false);
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
  });

  const sendMut = useMutation({
    mutationFn: () => api.auth.otp.send(phone.trim(), 0),
    onSuccess: (res) => {
      setRegStep('code');
      // сервер сам говорит, через сколько разрешит следующую отправку
      setResendLeft(res.resendAfterSeconds);
    },
  });

  const registerMut = useMutation({
    mutationFn: () =>
      api.auth.register({
        phoneNumber: phone.trim(),
        otp,
        fullName: fullName.trim(),
        password,
        password2,
      }),
    onSuccess: finish,
    onError: (e) => {
      // Пароли уходят вместе с кодом, но полей для них на экране кода нет:
      // если сервер забракует именно их, возвращаем на первый экран.
      if (!(e instanceof ApiError) || !e.field || !REG_FORM_FIELDS.includes(e.field)) return;
      setFormError({ field: e.field, message: e.message });
      setRegStep('form');
    },
  });

  const otpSendMut = useMutation({
    mutationFn: () => api.auth.otp.send(phone.trim(), 1),
    onSuccess: (res) => {
      setLoginOtpStep('code');
      setOtpResendLeft(res.resendAfterSeconds);
    },
  });

  const otpLoginMut = useMutation({
    mutationFn: () => api.auth.otp.login(phone.trim(), otp),
    onSuccess: finish,
  });

  /**
   * На экране кода ошибку может дать и регистрация, и повторная отправка —
   * берём ту, что случилась (регистрация приоритетнее: она свежее).
   */
  const screenMuts =
    tab === 'login'
      ? loginMode === 'password'
        ? [loginMut]
        : loginOtpStep === 'phone'
          ? [otpSendMut]
          : [otpLoginMut, otpSendMut]
      : regStep === 'form'
        ? [sendMut]
        : [registerMut, sendMut];
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
    otpSendMut.reset();
    otpLoginMut.reset();
    setFormError(null);
    setConsentError(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'login') {
      if (loginMode === 'password') loginMut.mutate();
      else if (loginOtpStep === 'phone') otpSendMut.mutate();
      else otpLoginMut.mutate();
      return;
    }
    if (regStep === 'form') {
      // Согласие — первым: без него регистрации не будет, и незачем тратить SMS.
      if (!consent) {
        setConsentError(true);
        return;
      }
      // ФИО — там же, до SMS: поля для него на экране кода нет,
      // а серверный отказ после ввода кода сжёг бы код впустую.
      const name = fullNameSchema.safeParse(fullName);
      if (!name.success) {
        setFormError({ field: 'fullName', message: name.error.issues[0].message });
        return;
      }
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

  const busy =
    loginMut.isPending ||
    sendMut.isPending ||
    registerMut.isPending ||
    otpSendMut.isPending ||
    otpLoginMut.isPending;
  /** экраны с вкладками — единственные, где под формой есть соц-входы */
  const withTabs =
    tab === 'login'
      ? loginMode === 'password' || loginOtpStep === 'phone'
      : regStep === 'form';

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
        {/* На /login и /signup эта карточка — вся страница, шапки с логотипом
            нет вовсе (см. страницы (auth)/login, /signup); в модалке она
            поверх любой другой страницы. В обоих случаях клик по логотипу
            должен вести на лендинг, как и в Header, — раньше это была просто
            картинка без ссылки. */}
        <Link href="/" aria-label="ecash" className="flex justify-center transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        {withTabs ? (
          <>
            {/* Вкладки и форма — колонка с зазором 44 */}
            <div className="flex flex-col gap-11">
              <PillTabs
                variant="r20"
                value={tab}
                onChange={(v) => {
                  setTab(v);
                  setOtp('');
                  // Вкладка «Вход» всегда открывается с пароля: SMS-режим —
                  // осознанный выбор на каждый заход, а не липкое состояние.
                  setLoginMode('password');
                  setLoginOtpStep('phone');
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
                loginMode === 'password' ? (
                  /* поля с зазором 8, под ними ссылка, затем кнопка через 12 */
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      {/* Только телефон, с маской при наборе — см. шапку файла. */}
                      <div className="flex flex-col gap-2">
                        <Input
                          placeholder={t('phoneLabel')}
                          value={loginValue}
                          onChange={(e) => setLoginValue(formatPhoneInput(e.target.value, loginValue))}
                          errors={err('login').concat(err('phoneNumber'))}
                          autoComplete="username"
                          inputMode="tel"
                          maxLength={18}
                        />
                        <Input
                          placeholder={t('passwordPlaceholder')}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          password
                          errors={err('password')}
                          autoComplete="current-password"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push('/recovery')}
                        className="flex h-[34px] w-fit cursor-pointer items-center rounded-[20px] text-sm font-medium leading-5 text-text-default transition-opacity hover:opacity-80"
                      >
                        {t('forgot')}
                      </button>
                    </div>

                    {generalError && <GeneralError text={generalError} />}
                    <Button type="submit" size="lg" className="w-full" disabled={busy}>
                      {t('continue')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        resetErrors();
                        // номер уже набран — переносим в SMS-режим,
                        // чтобы не набирать второй раз
                        const digits = loginValue.replace(/\D/g, '');
                        if (digits.length >= 10) setPhone(formatPhoneInput(loginValue));
                        setLoginMode('otp');
                      }}
                      className="cursor-pointer text-center text-sm font-medium leading-5 text-text-brand transition-opacity hover:opacity-80"
                    >
                      {t('byOtp')}
                    </button>
                  </div>
                ) : (
                  /* SMS-вход, шаг телефона: маска как в регистрации — коду
                     нужен именно номер, ИИН и почта здесь не подходят */
                  <div className="flex flex-col gap-3">
                    <Input
                      placeholder={t('phoneLabel')}
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneInput(e.target.value, phone))}
                      errors={err('login').concat(err('phoneNumber'))}
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={18}
                    />
                    {generalError && <GeneralError text={generalError} />}
                    <Button type="submit" size="lg" className="w-full" disabled={busy}>
                      {t('continue')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        resetErrors();
                        setLoginMode('password');
                      }}
                      className="cursor-pointer text-center text-sm font-medium leading-5 text-text-brand transition-opacity hover:opacity-80"
                    >
                      {t('byPassword')}
                    </button>
                  </div>
                )
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
                        setPhone(formatPhoneInput(e.target.value, phone));
                      }}
                      errors={err('login').concat(err('phoneNumber'))}
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={18}
                    />
                    {/* ФИО одной строкой — наша анкета, в ядре Ecash его нет.
                        Спрашиваем здесь, чтобы бронь подписывалась сама:
                        иначе человек вводил бы себя при каждом заказе.
                        Одно поле вместо трёх: на части строку раскладывает
                        сервер (splitFullName), человеку лишних движений нет. */}
                    <Input
                      placeholder={t('fullNamePlaceholder')}
                      value={fullName}
                      onChange={(e) => {
                        setFormError(null);
                        setFullName(e.target.value.slice(0, 160));
                      }}
                      errors={err('fullName')}
                      autoComplete="name"
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

                  <ConsentCheckbox
                    checked={consent}
                    error={consentError}
                    onChange={(v) => {
                      setOverride(v);
                      if (v) setConsentError(false);
                    }}
                    onOpenDoc={() => setConsentDocOpen(true)}
                  />

                  {generalError && <GeneralError text={generalError} />}
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {t('continue')}
                  </Button>
                </div>
              )}
            </div>

            {/* Линия-разделитель 1px, в раскладке высоты не занимает */}
            <div aria-hidden className="-mt-px h-px bg-divider-hole" />

            <div className="flex flex-col gap-2">
              <SocialButton icon={<TelegramIcon />} label={t('withTelegram')} />
              <SocialButton icon={<GoogleIcon />} label={t('withGoogle')} />
              <p
                id={SOCIAL_HINT_ID}
                className="text-center text-xs font-medium leading-[1.3] text-text-disabled"
              >
                {t('socialUnavailable')}
              </p>
            </div>
          </>
        ) : (
          <>
            {/* заголовок и описание с зазором 12 */}
            <div className="flex flex-col gap-3">
              <ModalTitle>{t('otpTitle')}</ModalTitle>
              <ModalText>{t('otpSent', { phone: phone.trim() })}</ModalText>
            </div>

            {/* Поле и кнопка с зазором 16. Экран общий для двух потоков:
                код регистрации (purpose 0) и код SMS-входа (purpose 1) —
                вкладка решает, чьи мутации и чей таймер здесь работают. */}
            <div className="flex flex-col gap-4">
              <Input
                placeholder={t('otpPlaceholder')}
                value={otp}
                onChange={(e) => {
                  // код проверяет финальный шаг потока — его же ошибку и гасим
                  (tab === 'login' ? otpLoginMut : registerMut).reset();
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
                size="lg"
                className="w-full"
                disabled={busy || otp.length !== 6}
              >
                {tab === 'login' ? t('continue') : t('register')}
              </Button>
              {/* Без повторной отправки экран кода — тупик: не дошло SMS,
                  и пройти дальше нечем. */}
              {(tab === 'login' ? otpResendLeft : resendLeft) > 0 ? (
                <p className="text-center text-sm font-medium leading-5 text-text-disabled">
                  {t('resendIn', { sec: tab === 'login' ? otpResendLeft : resendLeft })}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    (tab === 'login' ? otpLoginMut : registerMut).reset();
                    setOtp('');
                    (tab === 'login' ? otpSendMut : sendMut).mutate();
                  }}
                  disabled={tab === 'login' ? otpSendMut.isPending : sendMut.isPending}
                  className="cursor-pointer text-center text-sm font-medium leading-5 text-text-brand transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('resend')}
                </button>
              )}
              <BackButton
                onClick={() => {
                  if (tab === 'login') {
                    otpLoginMut.reset();
                    setOtp('');
                    setLoginOtpStep('phone');
                  } else {
                    registerMut.reset();
                    setRegStep('form');
                  }
                }}
              />
            </div>
          </>
        )}
      </form>

      {/*
        Вне <form>: у модалки своя разметка с кнопками, а вложенные формы —
        невалидный HTML (та же причина, что у AuthModal).
      */}
      <ConsentModal
        open={consentDocOpen}
        onClose={() => setConsentDocOpen(false)}
        onAccept={() => {
          // прочитал и принял — галочка ставится сама, возвращаться некуда
          setOverride(true);
          setConsentError(false);
          writeConsent();
          setConsentDocOpen(false);
        }}
      />
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
 * Согласие на обработку персональных данных — обязательное условие
 * регистрации по Закону РК «О персональных данных и их защите».
 *
 * Собственный квадрат вместо стандартного `<input type=checkbox>`: он
 * оформляется под макет, а настоящий input остаётся в разметке невидимым —
 * так сохраняются клавиатура, фокус и чтение экранными дикторами.
 *
 * Ссылка ведёт на полный текст и открывается в новой вкладке: уходить с
 * наполовину заполненной формы регистрации человек не должен.
 */
function ConsentCheckbox({
  checked,
  error,
  onChange,
  onOpenDoc,
}: {
  checked: boolean;
  error: boolean;
  onChange: (v: boolean) => void;
  /** открыть текст согласия окном поверх формы */
  onOpenDoc: () => void;
}) {
  const t = useTranslations('auth');
  const errId = 'consent-error';

  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-start gap-3">
        <span className="relative mt-px flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            aria-invalid={error || undefined}
            aria-describedby={error ? errId : undefined}
            className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden
            className={clsx(
              'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
              'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-stroke-brand',
              checked
                ? 'border-transparent bg-brand text-white'
                : error
                  ? // отдельного токена рамки для ошибки в макете нет —
                    // берём цвет текста ошибки, он для этого и заведён
                    'border-text-negative bg-transparent'
                  : 'border-stroke-input bg-transparent',
            )}
          >
            {checked && <Icon name="check" size={16} />}
          </span>
        </span>

        <span className="text-xs font-medium leading-[1.4] text-text-disabled">
          {t('consentBefore')}
          {/*
            Настоящая ссылка, но клик перехвачен: документ открывается окном
            поверх формы. Уводить человека со страницы нельзя — заполненные
            поля пропадут, а возврат и поиск галочки это лишние ходы.
            Если JS не отработал, ссылка остаётся ссылкой и ведёт на
            /legal/consent — документ доступен в любом случае.

            Именно <a>, а не <button>: строчный элемент переносится вместе
            с текстом, а кнопка — отдельным блоком, и точка после неё
            уезжала на свою строку.

            stopPropagation — чтобы клик не переключил сам чекбокс: ссылка
            лежит внутри <label>.
          */}
          <Link
            href="/legal/consent"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenDoc();
            }}
            className="text-text-brand underline underline-offset-2 hover:opacity-80"
          >
            {t('consentLink')}
          </Link>
          {t('consentAfter')}
        </span>
      </label>

      {error && (
        <p id={errId} className="text-xs font-medium leading-[1.3] text-text-negative">
          {t('consentRequired')}
        </p>
      )}
    </div>
  );
}

/**
 * Соц-вход 54×r20: фон surface/surf2, иконка 20×20 у левого края,
 * подпись по центру кнопки.
 *
 * Кнопка всегда неактивна: провайдера нет (см. комментарий у SOCIAL_HINT_ID).
 * Курсор «нельзя», причина написана подписью под парой и привязана к обеим
 * через aria-describedby — иначе кнопка молча не реагировала бы на клик, и
 * это выглядело бы поломкой.
 */
function SocialButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      disabled
      aria-describedby={SOCIAL_HINT_ID}
      className="relative flex h-[54px] w-full cursor-not-allowed items-center justify-center rounded-[20px] bg-surface-page-surf2 text-sm font-medium leading-5 text-text-default opacity-50"
    >
      <span className="absolute left-[17px] flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}
