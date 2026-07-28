'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { LeadForm } from './LeadForm';
import { Glows } from './Glows';
import { FloatImage, Magnetic, Spotlight, useReducedMotionSafe } from './effects';

type Card = { title: string; text: string; accent?: boolean };

/**
 * Лендинг франшизы — секция «landing / franch» макета.
 * Брейкпоинты: 1920 (2153:195405) · 1024 (2153:195710) · 768 (2153:195935)
 *              480 (2153:196159) · 360 (2153:196355)
 *
 * Порядок секций как в макете: Header · герой · [сплит «Ecash — это сеть…»
 * → 4 карточки] · [сплит «Что входит в пакет» → 2 ряда по 3] · [сплит «Этапы»
 * → сетка карточек] · баннер «Свяжитесь…» · [сплит «Поддержка» → 2 ряда по 6] ·
 * FAQ · footer.
 *
 * Паддинги страницы из фреймов: 20 (360/480/768) · 40 (1024) · колонка 1200
 * внутри бокса 1448 (1920). Отступ между секциями: 160 · 300 · 400 · 400.
 * Карточки: #262626 40 %, backdrop-blur 45.8, r40 → r64, p24 → p44, gap20 → gap40.
 * Светлого режима у лендинга в макете нет — тема форсирована классом theme-dark.
 *
 * Ступень 480 в макете самостоятельная (кегли почти десктопные), поэтому здесь
 * много вариантов min-[480px]: — своего брейкпоинта на 480 в теме нет.
 */
export function Landing() {
  const t = useTranslations('landing');
  const page = useRef<HTMLDivElement>(null);

  const advantages = t.raw('advantages') as Card[];
  const pkg = t.raw('package.items') as Card[];
  const steps = t.raw('steps.items') as Card[];
  const support = t.raw('support.items') as Card[];
  const faq = t.raw('faq.items') as { q: string; a: string }[];

  // Пары иконок vuesax из макета
  const advantageIcons: [string, string][] = [
    ['smartphone', 'monitor'],
    ['favorite', 'trending_up'],
    ['group', 'person'],
  ];

  return (
    <div
      ref={page}
      className="landing-bleed theme-dark relative min-h-screen overflow-x-hidden bg-surface-page-bg"
    >
      <Glows container={page} />

      <div className="relative z-10">
        <LandingHeader loginLabel={t('login')} />

        <Container>
          {/* ——— content 1 · герой ——— */}
          {/*
            До 768 макет ставит картинку первой и центрирует заголовок
            (фрейм 2153:196356: col gap40 cross:center, текст 32/500 center).
            С 768 — строка: текст слева, картинка справа. Плашка и монетка
            есть только на 1920 (2153:195623, 2153:195625).
          */}
          <section className="flex flex-col items-center gap-10 md:flex-row md:items-end md:gap-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.9,
                delay: 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-[104px] shrink-0 min-[480px]:w-[166px] md:order-2 md:mx-0 md:w-[344px] lg:w-[452px] xl:mr-[calc(var(--bleed)*-1)] xl:w-[580px]"
            >
              <FloatImage src="/img/landing/hero.png" tone="#F15A25" />
            </motion.div>

            <div className="min-w-0 flex-1 md:order-1">
              <HeroTitle
                lines={[t('hero.line1'), t('hero.line2'), t('hero.line3')]}
                coin={<CoinPill />}
                badge={<GradientPill>{t('hero.badge')}</GradientPill>}
              />
            </div>
          </section>

          {/* ——— content 2 · «Ecash — это сеть…» → карточки преимуществ ——— */}
          <Section>
            <SplitBlock
              image="/img/landing/tech.png"
              imageClassName="w-[184px] min-[480px]:w-[254px] md:w-[279px] lg:w-[354px] xl:w-[456px]"
              tone="#5500FF"
              /* 2153:196267 — у этого блока зазор заголовок→лид 20 до 768 */
              mobileGap={20}
              title={t('intro.title')}
              /* 2153:196269 — единственный лид, который на 480 остаётся 18/20 */
              leadUpFrom={768}
              leadTight
              leadClassName="xl:max-w-[577px]"
              text={t('intro.text')}
              cta={t('intro.cta')}
            />

            <div className="mt-20 flex flex-col gap-5 md:mt-[120px] lg:mt-40 lg:gap-10">
              <div className="grid gap-5 md:grid-cols-2 lg:gap-10 xl:grid-cols-[456fr_704fr]">
                <GlassCard card={advantages[0]} icons={advantageIcons[0]} index={0} />
                <GlassCard card={advantages[1]} icons={advantageIcons[1]} index={1} />
              </div>
              <div className="grid gap-5 md:grid-cols-2 lg:gap-10 xl:grid-cols-[704fr_456fr]">
                <GlassCard card={advantages[2]} icons={advantageIcons[2]} index={2} />
                <GlassCard card={advantages[3]} logo index={3} />
              </div>
            </div>
          </Section>

          {/* ——— content 3 · пакет франшизы ——— */}
          <Section>
            <SplitBlock
              reverse
              image="/img/landing/package.png"
              imageClassName="w-[184px] min-[480px]:w-[279px] lg:w-[354px] xl:w-[456px]"
              tone="#FF0051"
              titleClassName="flex flex-wrap items-center justify-center gap-3 md:justify-start"
              titleNode={
                <>
                  <span>{t('package.titleLine1')}</span>
                  <OutlinePill>{t('package.titleLine2')}</OutlinePill>
                  <span>{t('package.titleAccent')}</span>
                  <LogoDot />
                </>
              }
              text={t('package.text')}
            />
            <CardRails items={pkg} perRail={3} className="mt-20 md:mt-[120px] lg:mt-40" />
          </Section>

          {/* ——— content 4 · этапы открытия ——— */}
          {/*
            2153:195525 — заголовок и картинка стоят в одной строке (картинка
            справа, 580 на 1920), а сетка карточек идёт уже под ними.
          */}
          <Section>
            <SplitBlock
              reverse
              image="/img/landing/steps.png"
              imageClassName="w-[184px] min-[480px]:w-[279px] lg:w-[354px] xl:w-[580px]"
              tone="#F15A25"
              imageDelay={0.3}
              titleClassName="flex flex-wrap items-center justify-center gap-3 md:justify-start"
              titleNode={
                <>
                  <span>{t('steps.titleLine1')}</span>
                  <OutlinePill>{t('steps.titleLine2')}</OutlinePill>
                </>
              }
              /* 2153:196205 — на 480 лид этой секции слева, центрируется только 360 */
              leadClassName="min-[480px]:text-left"
              text={t('steps.text')}
            />

            {/*
              1920 (2153:195517…195524): ряды 704 + 456 и 456 + 704 попеременно.
              Сетка 456/208/456 с гэпом 40 даёт ровно 1200, а карточка на две
              колонки — ровно 704. До 1024 макет ставит две равные колонки.
            */}
            <div className="mt-20 grid gap-5 md:mt-[120px] md:grid-cols-2 lg:mt-40 lg:gap-10 xl:grid-cols-[456fr_208fr_456fr]">
              {steps.map((s, i) => (
                <StepCard key={s.title} step={s} index={i} />
              ))}
            </div>
          </Section>
        </Container>

        {/* ——— content 5 · баннер «Свяжитесь…» ——— */}
        <section
          id="lead"
          className="noise relative mt-40 overflow-hidden bg-white/8 py-[100px] md:mt-[300px] lg:mt-[400px] lg:py-32 xl:py-[100px]"
        >
          {/*
            Фрейм 360 (2153:196380): col gap40, p100/20, cross:center —
            картинка сверху, под ней текст и кнопка.
          */}
          <Container className="flex flex-col items-center gap-10 md:flex-row md:items-center md:gap-[60px] lg:gap-10 xl:gap-[164px]">
            {/* секция во всю ширину, но картинка в макете (2153:195514) стоит
                на x=236 — по левому краю бокса 1448, как и в сплит-блоках */}
            <Appear className="shrink-0 xl:ml-[calc(var(--bleed)*-1)]">
              <FloatImage
                src="/img/landing/contact.png"
                tone="#9D00FF"
                delay={0.5}
                className="w-[184px] min-[480px]:w-[279px] md:w-[238px] lg:w-[354px] xl:w-[456px]"
              />
            </Appear>
            <Appear className="flex w-full min-w-0 flex-1 flex-col items-center text-center md:items-start md:text-left">
              <SectionTitle className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <span>{t('contact.titleLine1')}</span>
                <OutlinePill>{t('contact.titleLine2')}</OutlinePill>
                <span>{t('contact.titleLine3')}</span>
                <ToggleMark />
              </SectionTitle>
              <Lead className="lg:max-w-[704px]">{t('contact.text')}</Lead>
              <LeadForm cta={t('contact.cta')} />
            </Appear>
          </Container>
        </section>

        <Container>
          {/* ——— content 6 · поддержка партнёров ——— */}
          <Section>
            <SplitBlock
              image="/img/landing/support.png"
              imageClassName="w-[279px] lg:w-[354px] xl:w-[456px]"
              tone="#FF4200"
              /* 2153:196219, 2153:196418 — единственный заголовок, который
                 остаётся 40/44 и на 480, и на 360 */
              titleAlwaysLarge
              title={t('support.title')}
              text={t('support.text')}
            />
            <CardRails
              items={support}
              perRail={6}
              variant="support"
              className="mt-20 md:mt-[120px] lg:mt-40"
            />
          </Section>

          {/* ——— content 7 · FAQ ——— */}
          <Section>
            <Appear>
              {/*
                Плата FAQ идёт в край экрана: 1448 на 1920 (2153:195430 —
                колонка 1200 плюс вынос 124), 1024 (2153:195735), 768
                (2153:195949), 480 (2153:196160) и 360 (2153:196359) —
                во всю ширину вьюпорта.
              */}
              <div className="-mx-5 rounded-[44px] border border-[#303030] bg-surface-page-surf1 p-5 min-[480px]:rounded-[64px] min-[480px]:p-9 lg:-mx-10 lg:p-16 xl:-mx-[124px]">
                <h2 className="text-center text-[32px] font-medium leading-[1.2] text-text-default min-[480px]:text-left min-[480px]:text-[40px] min-[480px]:leading-[44px]">
                  {t('faq.title')}
                </h2>
                <div className="mt-10 flex flex-col gap-2">
                  {faq.map((item, i) => (
                    <FaqRow key={item.q} q={item.q} a={item.a} index={i} />
                  ))}
                </div>
              </div>
            </Appear>
          </Section>
        </Container>

        <LandingFooter />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- раскладка */

/**
 * Колонка страницы: 20 (360/480/768) · 40 (1024) · 1200 внутри бокса 1448 (1920).
 *
 * На 1920 макет держит контент в колонке 1200 (360…1560), а картинки сплит-блоков
 * и карточка FAQ выходят за неё на 124 px наружу — отсюда бокс 1448 с паддингом
 * 124: ровно на этой ширине вьюпорта вынос упирается в край.
 *
 * От 1280 до 1448 у бокса нет внешнего поля, поэтому вылет картинок урезан
 * переменной --bleed (globals.css) — иначе они встают вплотную к краю экрана.
 * Плата FAQ так не урезается: у неё край экрана — это ступень 1024 макета
 * (2153:195735 — плата во всю ширину окна).
 */
function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'relative mx-auto w-full max-w-[1448px] px-5 lg:px-10 xl:px-[124px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Межсекционный отступ: 160 (360/480) · 300 (768) · 400 (1024/1920). */
function Section({ children }: { children: React.ReactNode }) {
  return <section className="relative pt-40 md:pt-[300px] lg:pt-[400px]">{children}</section>;
}

/**
 * Заголовок секции: 32/38.4 до 768, 40/44 с 768.
 * alwaysLarge — секция «Поддержка для партнеров», где макет держит 40/44 везде.
 */
function SectionTitle({
  children,
  className,
  alwaysLarge,
}: {
  children: React.ReactNode;
  className?: string;
  alwaysLarge?: boolean;
}) {
  return (
    <h2
      className={clsx(
        'font-medium text-text-default',
        alwaysLarge
          ? 'text-[40px] leading-[44px]'
          : 'text-[32px] leading-[1.2] md:text-[40px] md:leading-[44px]',
        className,
      )}
    >
      {children}
    </h2>
  );
}

/**
 * Лид секции: 18/20 на 360, 24/32 с 480 (у сплит-блока «Ecash — это сеть…»
 * макет держит 18/20 до 768 — там upFrom=768).
 * tight — зазор заголовок→лид 20 вместо 32 (2153:196267).
 */
function Lead({
  children,
  className,
  upFrom = 480,
  tight,
}: {
  children: React.ReactNode;
  className?: string;
  upFrom?: 480 | 768;
  tight?: boolean;
}) {
  return (
    <p
      className={clsx(
        'text-lg leading-5 text-text-default',
        tight ? 'mt-5 md:mt-8' : 'mt-8',
        upFrom === 480 ? 'min-[480px]:text-2xl min-[480px]:leading-8' : 'md:text-2xl md:leading-8',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Появление блока при скролле. */
function Appear({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotionSafe();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Заголовок героя: строки выезжают снизу по очереди. */
function HeroTitle({
  lines,
  coin,
  badge,
}: {
  lines: [string, string, string];
  coin: React.ReactNode;
  badge: React.ReactNode;
}) {
  const reduced = useReducedMotionSafe();

  // Монетка и плашка есть только на 1920: справа от второй и третьей строки.
  // Ниже 1920 (2153:195921, 2153:195946, 2153:196352) в герое только заголовок.
  const trailing = [null, coin, badge];

  /**
   * Маска строки нужна только на время выезда: строка стартует из y=110%, и без
   * overflow:hidden она была бы видна до начала анимации. Но у монетки свечение
   * 0 0 44px (вылет 22px), у плашки — 0 0 28px (14px), а запас внутри маски
   * всего 16px сверху и 20px снизу, поэтому в покое маска срезает их резкой
   * горизонтальной кромкой. Снимаем клип по завершении выезда: сама анимация
   * не меняется, на размеры бокса overflow не влияет.
   */
  const [revealed, setRevealed] = useState<boolean[]>(() => lines.map(() => false));
  const markRevealed = (i: number) =>
    setRevealed((prev) => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = true;
      return next;
    });

  return (
    // flex-колонка, а не блок: иначе -mb-1 последней строки схлопнется
    // с внешним отступом и блок станет на 4 px выше макетных 288.
    <h1 className="flex flex-col text-[32px] font-medium leading-[1.2] text-text-default md:text-5xl md:font-bold md:leading-none lg:text-[64px] xl:text-[96px]">
      {lines.map((line, i) => {
        const row = (
          <>
            {line}
            <span className="hidden xl:contents">{trailing[i]}</span>
          </>
        );

        // pb-1 нужен только маске анимации, поэтому гасится -mb-1:
        // иначе высота блока растёт на 4 px в строке (макет — ровно 288).
        return (
          <span
            key={line}
            className={clsx(
              '-mb-1 block pb-1',
              // при reduced-motion выезда нет вовсе — маска не нужна с самого начала
              reduced || revealed[i] ? 'overflow-visible' : 'overflow-hidden',
            )}
          >
            {reduced ? (
              <span className="flex flex-wrap items-center justify-center gap-3 md:justify-start xl:gap-6">
                {row}
              </span>
            ) : (
              <motion.span
                className="flex flex-wrap items-center justify-center gap-3 md:justify-start xl:gap-6"
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{
                  duration: 0.75,
                  delay: 0.1 + i * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                onAnimationComplete={() => markRevealed(i)}
              >
                {row}
              </motion.span>
            )}
          </span>
        );
      })}
    </h1>
  );
}

/**
 * Плашка «Вместе с франшизой Ecash» — 248×72, r50, p8/20,
 * обводка 3px градиентом #F6844B → #BF5AF5, текст 20/700 lh25.
 *
 * Кольцо собрано из двух слоёв — градиентная подложка плюс внутренний фон.
 * Через mask-composite край на скруглении рвался и текст выглядел мыльным.
 */
function GradientPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-[50px] bg-[image:var(--gradient-accent)] p-[3px] align-middle shadow-[0_0_28px_rgb(191_90_245/0.3)]">
      <span className="inline-flex items-center rounded-[48px] bg-surface-page-bg px-5 py-2 text-xl font-bold leading-[25px] tracking-normal text-text-default">
        {children}
      </span>
    </span>
  );
}

/**
 * Монетка ecash в пилюле — logo 124×64, r51.2, fill #F15A25 из макета
 * (2153:195625). Есть только на 1920.
 */
function CoinPill() {
  return (
    <motion.span
      whileHover={{ scale: 1.06, rotate: -4 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      className="inline-flex h-16 w-[124px] shrink-0 items-center justify-center rounded-[51px] bg-brand shadow-[0_0_44px_rgb(241_90_37/0.5)]"
    >
      <img
        src="/img/mark-white.png"
        alt=""
        width={111}
        height={159}
        className="h-[38.4px] w-auto"
      />
    </motion.span>
  );
}

/**
 * Кант 2 px градиентом #F6844B → #BF5AF5 поверх прозрачного фона.
 * Обычный border-image сломал бы фон секции под плашкой, поэтому рамка
 * рисуется псевдоэлементом с маской — как у карточек (.glass-accent).
 */
const RING_2PX = [
  'relative before:pointer-events-none before:absolute before:inset-0',
  "before:rounded-[inherit] before:p-[2px] before:content-['']",
  'before:[background:var(--gradient-accent)]',
  // только длинные свойства: сокращение mask сбрасывает mask-composite,
  // а порядок утилит в собранном CSS не гарантирован
  'before:[-webkit-mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)]',
  'before:[mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)]',
  'before:[-webkit-mask-clip:content-box,border-box]',
  'before:[mask-clip:content-box,border-box]',
  'before:[-webkit-mask-composite:xor] before:[mask-composite:exclude]',
].join(' ');

/**
 * Плашка-пилюля вокруг акцентного слова заголовка: r30, p2/20/8/20,
 * обводка 2px градиентом (2153:195563 «франшизы», 2153:195529 «обмена валют»,
 * 2153:195505 «начните зарабатывать»). Текст внутри — обычный #EEEEEE.
 */
function OutlinePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        // с 768 в макете плашка 58 при строке 44 — высоту задаём явно,
        // иначе паддинги 2/8 дают 54 и заголовок садится на 4 px выше
        'inline-flex items-center rounded-[30px] px-5 pb-2 pt-0.5 md:min-h-[58px]',
        // strokeAlign=INSIDE: с 768 макет считает кант 2 px частью габарита
        // (474 при тексте 430 — 2153:195505, 315 при 271 — 2153:195529),
        // а до 480 — нет (204 при 164 — 2153:196311), поэтому +2 только с md
        'md:px-[22px]',
        RING_2PX,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Фирменный кружок после слова «Ecash» в заголовке «Что входит в пакет»
 * (2153:195566): 54×54, r43.2, #F15A25 с белым знаком 22.63×32.4.
 */
function LogoDot() {
  return (
    <span className="inline-flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[43.2px] bg-brand">
      <img
        src="/img/mark-white.png"
        alt=""
        width={111}
        height={159}
        className="h-[32.4px] w-auto"
      />
    </span>
  );
}

/**
 * Декоративный «переключатель» в конце заголовка секции контактов
 * (2153:195508): 84×44, r28, обводка 2 #EEEEEE, кружок 28×28 #F15A25
 * у правого края (отступ 8).
 */
function ToggleMark() {
  return (
    <span className="inline-flex h-11 w-[84px] shrink-0 items-center justify-end rounded-[28px] border-2 border-text-default pr-1.5">
      <span className="block h-7 w-7 rounded-full bg-brand" />
    </span>
  );
}

/**
 * Сплит-блок: картинка + текст. 1920 — в строку с зазором 164,
 * 1024 — 40, мобильный — колонка. У «прямых» блоков картинка сверху,
 * у reverse (пакет, этапы) — под текстом (2153:196307, 2153:196198).
 */
function SplitBlock({
  image,
  imageClassName,
  imageDelay,
  tone,
  title,
  titleNode,
  titleClassName,
  titleAlwaysLarge,
  text,
  leadClassName,
  leadUpFrom,
  leadTight,
  cta,
  reverse,
  mobileGap = 40,
}: {
  image: string;
  /** ширина картинки по брейкпоинтам — в макете она у каждой секции своя */
  imageClassName: string;
  imageDelay?: number;
  /** цвет ореола под картинкой — под свечение своей секции */
  tone: string;
  title?: string;
  titleNode?: React.ReactNode;
  titleClassName?: string;
  titleAlwaysLarge?: boolean;
  text: string;
  leadClassName?: string;
  leadUpFrom?: 480 | 768;
  leadTight?: boolean;
  cta?: string;
  reverse?: boolean;
  /** зазор картинка↔текст до 768: 20 у «Ecash — это сеть…», 40 у остальных */
  mobileGap?: 20 | 40;
}) {
  return (
    <div
      className={clsx(
        'relative flex md:gap-10 xl:gap-[164px]',
        mobileGap === 20 ? 'gap-5' : 'gap-10',
        reverse
          ? 'flex-col-reverse items-center md:flex-row-reverse'
          : 'flex-col items-center md:flex-row',
      )}
    >
      {/* на 1920 картинка выходит из колонки 1200 наружу на 124 px; на узких
          десктопах вылет урезан до доступного поля — см. --bleed в globals.css */}
      <Appear
        className={clsx(
          'shrink-0',
          reverse ? 'xl:mr-[calc(var(--bleed)*-1)]' : 'xl:ml-[calc(var(--bleed)*-1)]',
        )}
      >
        <FloatImage src={image} tone={tone} delay={imageDelay} className={imageClassName} />
      </Appear>
      <Appear delay={0.08} className="min-w-0 flex-1 text-center md:text-left">
        <SectionTitle className={titleClassName} alwaysLarge={titleAlwaysLarge}>
          {titleNode ?? title}
        </SectionTitle>
        <Lead className={leadClassName} upFrom={leadUpFrom} tight={leadTight}>
          {text}
        </Lead>
        {cta && <CtaButton className="mt-10 md:mt-20">{cta}</CtaButton>}
      </Appear>
    </div>
  );
}

/* --------------------------------------------------------------- элементы */

/**
 * Material-иконка с размером из класса.
 *
 * Icon задаёт fontSize инлайновым стилем, поэтому адаптивные классы на нём
 * не срабатывают, а в макете размер иконки меняется по брейкпоинтам
 * (21.33 → 48 у карточек преимуществ, 20 → 32 у соцсетей).
 */
function ScalableIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={clsx('material-symbols-rounded select-none leading-none', className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}

/**
 * Шапка: ≤768 сплошная #262626 с границей #333333; ≥1024 стекло #FFFFFF 8 %.
 * Боковые поля по фреймам Header: 16 (360/480), 52 (768), 40 (1024),
 * 124 внутри бокса 1448 (1920). Высота 75 / 83 — вместе с нижней границей.
 */
function LandingHeader({ loginLabel }: { loginLabel: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-stroke-surface1 bg-surface-page-surf1 lg:border-white/12 lg:bg-white/8 lg:backdrop-blur-2xl">
      <div className="relative mx-auto flex h-[74px] w-full max-w-[1448px] items-center justify-between px-4 md:h-[82px] md:px-[52px] lg:px-10 xl:px-[124px]">
        <Link href="/" aria-label="ecash" className="transition-opacity hover:opacity-80">
          <Logo tone="onDark" />
        </Link>
        <Link
          href="/login"
          className="inline-flex h-[42px] items-center gap-2 rounded-2xl border border-btn-1 bg-btn-1 pl-3 pr-2 text-sm font-medium leading-5 text-text-default transition-colors hover:bg-comp-surface2-hover md:h-[50px] md:pl-6 md:pr-4 lg:border-white/12 lg:bg-white/8 lg:hover:bg-white/15"
        >
          {loginLabel}
          <Icon name="login" size={20} />
        </Link>
      </div>
    </header>
  );
}

/** Футер: #333333, кант #303030 (#6B6B6B до 480), поля 24 / 20 / 40 / 124. */
function LandingFooter() {
  const t = useTranslations('footer');

  return (
    <footer className="relative mt-40 border-t border-[#6B6B6B] bg-surface-modal-bg md:mt-[300px] md:border-[#303030] lg:mt-[400px]">
      <div className="relative mx-auto w-full max-w-[1448px] px-6 py-6 md:px-5 md:py-[60px] lg:px-10 xl:px-[124px] xl:pt-[100px]">
        {/* 768 (2153:195970): одна центрированная колонка, gap 60; с 1024 — ряд */}
        <div className="flex flex-col gap-6 md:items-center md:gap-[60px] lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-2 md:items-center md:gap-6 lg:items-start">
            <div className="flex gap-2 md:gap-4">
              <SocialLink href="https://wa.me/77059089073" label="WhatsApp">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                  className="h-5 w-5 md:h-8 md:w-8"
                >
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.1 4c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.4 3.9 2.2.9 2.6.7 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.2-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.5-.6c.1-.2.1-.3.2-.5v-.4L10.3 8c-.1-.3-.3-.3-.5-.3h-.4l-.5.1Z" />
                </svg>
              </SocialLink>
              <SocialLink href="https://t.me/ecash" label="Telegram">
                <ScalableIcon name="send" filled className="text-[20px] md:text-[32px]" />
              </SocialLink>
            </div>
            <a
              href="tel:+77059089073"
              className="text-base leading-5 text-text-default transition-colors hover:text-text-brand md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]"
            >
              +7 (705) 908 90 73
            </a>
          </div>

          <div className="flex flex-col gap-2 md:items-center md:gap-6 lg:items-start lg:gap-10">
            <div className="text-sm leading-[1.1] text-text-disabled md:text-xl md:leading-8 md:text-text-default">
              {t('schedule')}
            </div>
            <div className="text-base leading-5 text-text-default md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]">
              {t('scheduleValue')}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:items-center md:gap-6 lg:items-start lg:gap-10">
            <div className="text-sm leading-[1.1] text-text-disabled md:text-xl md:leading-8 md:text-text-default">
              {t('additional')}
            </div>
            <span className="inline-flex items-center gap-2.5 text-base leading-5 text-text-default md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]">
              {t('documents')}
              <Icon name="arrow_outward" size={20} />
            </span>
          </div>
        </div>

        {/* 480 (2003:125422): копирайт у левого края, 768 — по центру */}
        <div className="mt-12 text-left text-sm leading-[1.1] text-text-disabled md:mt-20 md:text-center md:text-xl md:leading-8 md:text-text-default lg:text-left">
          © {new Date().getFullYear()}. {t('rights')}
        </div>
      </div>
    </footer>
  );
}

/** Плитка соцсети: 42×42 r16 #262626 до 768, 72×72 r28 #272626 с 768. */
function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.94 }}
      className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface2-hover md:h-[72px] md:w-[72px] md:rounded-[28px] md:bg-[#272626]"
    >
      {children}
    </motion.a>
  );
}

/**
 * Карточка преимуществ: #262626 40 %, backdrop-blur 45.8, кант #303030
 * (у акцентной — градиентный), r40 → r64, p24 → p44, gap20 → gap40.
 */
function GlassCard({
  card,
  icons,
  logo,
  index,
}: {
  card: Card;
  icons?: [string, string];
  logo?: boolean;
  index: number;
}) {
  const accent = Boolean(card.accent);
  const reduced = useReducedMotionSafe();

  const body = (
    <Spotlight
      tone={accent ? '#BF5AF5' : '#F6844B'}
      className={clsx(
        'group flex h-full flex-col gap-5 rounded-[40px] bg-[#262626]/40 p-6 glass-blur md:p-9 lg:gap-10 lg:rounded-[64px] lg:p-11',
        // 2153:195603 — у акцентной карточки кант градиентный, у остальных #303030
        accent ? 'glass-accent' : 'border border-[#303030]',
      )}
    >
      {logo ? (
        // 2153:195604 — логотип 72×72 в обёртке 96×96 (p12); на 360 — 32 в 56
        <span className="flex h-14 w-14 items-center justify-center p-3 min-[480px]:h-24 min-[480px]:w-24">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand shadow-[0_0_40px_rgb(241_90_37/0.5)] transition-transform duration-300 group-hover:scale-110 min-[480px]:h-[72px] min-[480px]:w-[72px]">
            <img
              src="/img/mark-white.png"
              alt=""
              width={111}
              height={159}
              className="h-[19.2px] w-auto min-[480px]:h-[43.2px]"
            />
          </span>
        </span>
      ) : (
        icons && (
          <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[24px] border-2 border-[#616161] transition-colors duration-300 group-hover:border-brand md:h-[100px] md:w-[100px] md:rounded-[32px]">
            {/* 2153:195575 — пара иконок 48×48 в блоке 72×72; на 480/360 — 21.33 в 32 */}
            <span className="relative h-8 w-8 md:h-[72px] md:w-[72px]">
              <ScalableIcon
                name={icons[0]}
                filled
                className="absolute left-0 top-0 text-[21.33px] text-brand drop-shadow-[0_0_12px_rgb(241_90_37/0.6)] transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 md:text-[48px]"
              />
              <ScalableIcon
                name={icons[1]}
                filled
                className="absolute bottom-0 right-0 text-[21.33px] text-text-default transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5 md:text-[48px]"
              />
            </span>
          </span>
        )
      )}

      <div className="flex flex-col gap-6">
        <h3
          className={clsx(
            'font-rubik text-xl font-medium leading-7 md:font-sans md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]',
            accent ? 'text-text-brand' : 'text-text-default',
          )}
        >
          {card.title}
        </h3>
        <p
          className={clsx(
            'text-base leading-[1.24] md:text-xl md:leading-8',
            accent ? 'text-text-brand' : 'text-text-default',
          )}
        >
          {card.text}
        </p>
      </div>
    </Spotlight>
  );

  if (reduced) return <div className="h-full">{body}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.55,
        delay: (index % 2) * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -6 }}
      className="h-full"
    >
      {body}
    </motion.div>
  );
}

/**
 * Карточка этапа: номер 50×50 r16 на #303030 с градиентным кантом (2112:192944).
 * На 1920 ряды идут 704 + 456 и 456 + 704 — это span 2 у элементов 0, 3, 4, …
 */
function StepCard({ step, index }: { step: Card; index: number }) {
  const reduced = useReducedMotionSafe();
  const wide = index % 4 === 0 || index % 4 === 3;

  const cls = clsx(
    'glass-veil group h-full rounded-[64px] p-9 glass-blur lg:p-11',
    wide && 'xl:col-span-2',
  );

  const body = (
    <>
      <span className="grad-border inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl bg-[#303030] text-lg font-medium leading-6 text-text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-text-always-white">
        {index + 1}
      </span>
      {/*
        Мастер 2088:55218 в спеку выгружен координатами компонента, но высоты
        инстансов сходятся только при 28/32 + 20/32 с 480 (карточка 440×362 =
        36 + 50 + 24 + 64 + 24 + 128 + 36) и 20/28 + 16/1.24 на 360
        (320×326 = 36 + 50 + 24 + 56 + 24 + 99 + 36).
      */}
      <h3 className="mt-6 font-rubik text-xl font-medium leading-7 text-text-default min-[480px]:font-sans min-[480px]:text-[28px] min-[480px]:font-semibold min-[480px]:leading-8 min-[480px]:tracking-[-0.45px] lg:mt-11">
        {step.title}
      </h3>
      <p className="mt-6 text-base leading-[1.24] text-text-default min-[480px]:text-xl min-[480px]:leading-8">
        {step.text}
      </p>
    </>
  );

  if (reduced) return <article className={cls}>{body}</article>;

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay: (index % 2) * 0.08 }}
      whileHover={{ y: -6 }}
      className={cls}
    >
      {body}
    </motion.article>
  );
}

/**
 * Кнопка макета: 254×66 r40 p16/24 gap16 до 768 → 254×80 r102 p24/40 gap24
 * с 768 (2153:196270 и 2153:195617). Ширина фиксированная, текст 24/32.
 */
function CtaButton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Magnetic className={clsx('inline-block', className)}>
      <a
        href="#lead"
        className="group relative inline-flex h-[66px] w-[254px] cursor-pointer items-center justify-center gap-4 overflow-hidden rounded-[40px] bg-brand px-6 text-2xl leading-8 text-text-default shadow-[0_12px_40px_rgb(241_90_37/0.45)] transition-[box-shadow,filter] hover:shadow-[0_20px_64px_rgb(241_90_37/0.65)] hover:brightness-110 md:h-20 md:gap-6 md:rounded-[102px] md:px-10"
      >
        {/* блик, пробегающий по кнопке при наведении */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-full w-1/2 skew-x-[-20deg] bg-white/25 blur-md transition-[left] duration-700 ease-out group-hover:left-[150%]"
        />
        {children}
        <Icon
          name="arrow_forward"
          size={32}
          className="transition-transform duration-300 group-hover:translate-x-1"
        />
      </a>
    </Magnetic>
  );
}

/**
 * Стартовая прокрутка рядов из макета.
 *
 * Внутри «wrapper (scroll container) for prototipe» трек-фрейм стоит с
 * отрицательным x — это и есть начальный scrollLeft ряда. Из-за него ряды не
 * выстраиваются «по линейке» с первой карточки, и блок выглядит живым.
 *
 * 1920 (2153:195405): 195537 −992, 195548 0 · 195460 −1240, 195480 −744
 * 1024 (2153:195710): 195854 −1248, 195865 0 · 195764 −1120, 195784 −620
 *  768 (2153:195935): 196092 −599, 196103 0 · 196038 −748, 196058 −599
 *
 * Порог 80rem — тот же xl, которым весь лендинг отделяет фрейм 1920 от 1024
 * (боковые поля колонки, размеры картинок, кегль заголовка).
 *
 * Пороги записаны в rem, как у самого Tailwind (md 48rem, lg 64rem, xl 80rem),
 * а не в пикселях. В медиазапросе rem считается от базового кегля браузера, и
 * если пользователь его увеличил (Chrome, «Размер шрифта → Большой» = 20px),
 * md наступает не на 768, а на 960. Порог в px разошёлся бы с шириной
 * карточки: замером поймано, что на 800px при кегле 20 карточка ещё w-full,
 * а смещение уже применялось — ряд открывался на второй карточке, ровно та
 * обрезанная половина, которую владелец просил не показывать.
 *
 * Ниже md смещения нет — вопреки макету, где оно задано и на 480, и на 360.
 * Там карточка занимает всю ширину ряда, на экране помещается ровно одна, и
 * любой сдвиг показал бы обрезанную половину: решение владельца.
 *
 * Отрицательные margin ряда (-mx-8) и равный им padding (px-8) друг друга
 * гасят, поэтому scrollLeft отсчитывается от той же точки, что x трека в
 * Figma, и значения переносятся один в один. Проверено замером.
 *
 * Единственное отступление от макета — «поддержка», ряд 1 на xl: 1550 вместо
 * 1240. Шаг карточки здесь 620 (580 + 40), а 1240 = ровно два шага, поэтому
 * третья карточка вставала вплотную к левому краю и ряд снова читался
 * «по линейке» — ровно то, от чего смещения и должны уводить. 1550 не кратно
 * шагу и даёт картину «обрезана — целиком — обрезана»: «Проектирование»
 * видно на 270px, «Бухгалтерия» целиком, «Казначейство» на 262px.
 * Остальные значения макета шагу не кратны и в правке не нуждались:
 * 1120 = 620 + 500 (lg), 748 = 449 + 299 (md).
 */
const RAIL_SCROLL: Record<'package' | 'support', { mq: string; rails: number[] }[]> = {
  package: [
    { mq: '(min-width: 80rem)', rails: [992, 0] },
    { mq: '(min-width: 64rem)', rails: [1248, 0] },
    { mq: '(min-width: 48rem)', rails: [599, 0] },
  ],
  support: [
    // 1550 вместо макетных 1240 — сознательное отступление, см. комментарий выше
    { mq: '(min-width: 80rem)', rails: [1550, 744] },
    { mq: '(min-width: 64rem)', rails: [1120, 620] },
    { mq: '(min-width: 48rem)', rails: [748, 599] },
  ],
};

/**
 * Ряды карточек («complex slider»): по 3 (пакет) или 6 (поддержка) в ряд.
 * Ряд горизонтальный на всех ширинах — в макете это scroll container колонки
 * (2153:196222, 2153:196421, 2153:196037, 2153:195459). Ширина карточки равна
 * колонке до 768 (440 / 320), 429 на 768, 704 (пакет) / 580 (поддержка) с 1024.
 * Зазор 12 → 20 → 40.
 */
function CardRails({
  items,
  perRail,
  variant = 'package',
  className,
}: {
  items: Card[];
  perRail: number;
  /** «package» — карточки 704 (content 3); «support» — 580 (content 6).
   *  Оформление одинаковое: чередование стекла и плотной заливки с кантом. */
  variant?: 'package' | 'support';
  className?: string;
}) {
  const rails: Card[][] = [];
  for (let i = 0; i < items.length; i += perRail) rails.push(items.slice(i, i + perRail));

  const railEls = useRef<(HTMLDivElement | null)[]>([]);

  /**
   * Стартовое смещение выставляем после монтирования, а не в разметке: ширины
   * окна на сервере нет, и любое смещение в SSR-разметке разошлось бы с
   * клиентом — на лендинге такую ошибку гидратации уже чинили. Значения
   * детерминированные, из таблицы выше.
   *
   * Ступень выбираем через matchMedia, ровно теми же порогами, что и Tailwind,
   * чтобы смещение и ширина карточки переключались одновременно.
   *
   * Пересчитываем на каждой смене ширины окна, а не только на смене ступени.
   * Ширина ряда внутри одной ступени плавающая, и максимум прокрутки вместе с
   * ней: у первого ряда «пакет» смещение макета равно этому максимуму, поэтому
   * на промежуточной ширине браузер зажимает его (на 1279 — до 993). Если
   * пересчитывать только на смене ступени, зажатое значение так и остаётся:
   * ряд приезжает на 1024 с 993 вместо 1248. Замером поймано.
   *
   * Сравниваем именно ширину: ресайз по одной высоте (адресная строка на
   * мобильном прячется и появляется) ряд не трогает.
   */
  useEffect(() => {
    const steps = RAIL_SCROLL[variant];
    let appliedWidth = -1;

    const apply = () => {
      if (window.innerWidth === appliedWidth) return;
      appliedWidth = window.innerWidth;
      const step = steps.find((s) => window.matchMedia(s.mq).matches);

      railEls.current.forEach((el, i) => {
        // Мгновенно и без behavior: 'smooth' — это стартовое состояние ряда,
        // а не анимация. Браузер сам зажмёт значение по максимуму прокрутки.
        if (el) el.scrollLeft = step ? (step.rails[i] ?? 0) : 0;
      });
    };

    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [variant]);

  return (
    <div className={clsx('flex flex-col gap-5 lg:gap-10', className)}>
      {rails.map((rail, railIndex) => (
        <div
          key={railIndex}
          ref={(el) => {
            railEls.current[railIndex] = el;
          }}
          /*
           * overflow-x:auto по спецификации делает и overflow-y:auto, поэтому
           * ряд обрезает всё, что выходит за его границы: подъём карточки на
           * ховере и, главное, её тень — на срезе видны резкие углы.
           *
           * Тень на ховере — 0 32px 80px -28px, значит она выходит за карточку
           * на 12px по бокам (80/2 − 28) и на 44px вниз (32 + 80/2 − 28), вверх
           * не выходит вовсе. Берём двойной запас: 32 по бокам и сверху, 96
           * снизу — тень гарантированно нигде не достаёт до границы отсечения.
           * Отрицательные margin ровно на ту же величину возвращают исходную
           * геометрию, поэтому карточки не сдвигаются. Боковой вылет за край
           * экрана безопасен: у обёртки лендинга overflow-x: hidden.
           *
           * scroll-pl-8 — чтобы snap-start приклеивал карточку к тому же месту,
           * где стоит первая: снаппорт по умолчанию считается от padding-бокса.
           *
           * md:snap-none — с 768 снап выключен совсем. Смещения макета не
           * выровнены по карточкам, а снап притягивает прокрутку к ближайшей
           * точке привязки и при программной установке scrollLeft тоже:
           * замером поймано, что ряд «поддержка-2» на 1920 уезжает с нужных
           * 744 на 620 (шаг карточки). Проксимити ведёт себя так же — это
           * проверено, а не взято из документации; возврат снапа после
           * установки тоже отщёлкивает ряд назад. Держит смещение только
           * scroll-snap-type: none. Ручная прокрутка от этого не страдает:
           * с 768 в ряду видно несколько карточек, свободный скролл там
           * привычнее принудительного.
           *
           * Ниже md снап остаётся mandatory и полезен: карточка занимает всю
           * ширину ряда, помещается ровно одна, смещения нет — притягивать
           * некуда, кроме как к границе карточки.
           */
          className="-mx-8 -mb-24 -mt-8 flex snap-x snap-mandatory scroll-pl-8 flex-row gap-3 overflow-x-auto px-8 pb-24 pt-8 [scrollbar-width:none] md:snap-none md:gap-5 lg:gap-10 [&::-webkit-scrollbar]:hidden"
        >
          {rail.map((item, i) => (
            <RailCard key={item.title} item={item} index={i} variant={variant} />
          ))}
        </div>
      ))}
    </div>
  );
}

function RailCard({
  item,
  index,
  variant = 'package',
}: {
  item: Card;
  index: number;
  variant?: 'package' | 'support';
}) {
  const reduced = useReducedMotionSafe();
  const support = variant === 'support';

  /**
   * Заливки из макета.
   * Пакет (2153:195538…195557): 0 — плотная #262626 60 % с градиентным кантом,
   * 1 — стекло с белым кантом, 2 — стекло с градиентным кантом.
   * Поддержка (2153:195461…195496): чётные — стекло, нечётные — плотная
   * заливка с градиентным кантом.
   */
  const dense = support ? index % 2 === 1 : index % 3 === 0;
  const gradient = support ? index % 2 === 1 : index % 3 !== 1;

  const cls = clsx(
    'w-full shrink-0 snap-start md:w-[429px]',
    support ? 'lg:w-[580px]' : 'lg:w-[704px]',
  );

  const body = (
    <Spotlight
      tone={gradient ? '#BF5AF5' : '#F6844B'}
      className={clsx(
        'flex h-full flex-col gap-6 rounded-[64px] p-9 glass-blur lg:gap-11 lg:p-16',
        dense ? 'glass-dense' : 'glass-veil',
        gradient && 'glass-accent',
      )}
    >
      <h3 className="font-rubik text-xl font-medium leading-7 text-text-default md:font-sans md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]">
        {item.title}
      </h3>
      <p className="text-base leading-[1.24] text-text-default md:text-xl md:leading-8">
        {item.text}
      </p>
    </Spotlight>
  );

  if (reduced) return <div className={cls}>{body}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 3) * 0.07 }}
      whileHover={{ y: -6 }}
      className={cls}
    >
      {body}
    </motion.div>
  );
}

/**
 * Спойлер FAQ: p20 r36 (360) → p24 (480) → p44 r64 (768+) на #303030,
 * разделитель #454545. Третий пункт в макете раскрыт на всех ширинах
 * (2153:195443, 2153:196173, 2153:196372).
 */
function FaqRow({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(index === 2);

  return (
    <div
      className={clsx(
        'rounded-[36px] bg-[#303030] p-5 transition-colors duration-300 min-[480px]:p-6 md:rounded-[64px] md:p-11',
        open ? 'bg-[#3b3b3b]' : 'hover:bg-[#363636]',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 text-left"
      >
        <span className="min-w-0 flex-1 text-lg leading-5 text-text-default min-[480px]:text-[28px] min-[480px]:font-semibold min-[480px]:leading-8 min-[480px]:tracking-[-0.45px]">
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className={clsx(
            'flex shrink-0 text-text-default transition-colors',
            open && 'text-text-brand',
          )}
        >
          <Icon name="keyboard_arrow_down" size={24} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-6 border-t border-[#454545] pt-6 text-base leading-[1.24] text-text-default min-[480px]:text-xl min-[480px]:leading-8">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
