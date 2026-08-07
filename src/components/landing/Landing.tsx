"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { Footer } from "@/components/layout/Footer";
import { ContactModal } from "./ContactModal";
import { Glows } from "./Glows";
import { FloatImage, GrainOverlay, Magnetic, Spotlight } from "./effects";
import { VuesaxIcon, type VuesaxName } from "./VuesaxIcons";

type Card = { title: string; text: string; accent?: boolean };

/**
 * Лендинг франшизы — секция «landing / franch» макета.
 * Брейкпоинты: 1920 (2153:195405) · 1024 (2153:195710) · 768 (2153:195935)
 *              480 (2153:196159) · 360 (2153:196355)
 *
 * Порядок секций как в макете: Header · герой · [сплит «Ecash — это сеть…»
 * → 4 карточки] · [сплит «Что входит в пакет» → 2 ряда по 3] · этапы ·
 * баннер «Свяжитесь…» · [сплит «Поддержка» → 2 ряда по 6] · FAQ · footer.
 *
 * Паддинги страницы из фреймов: 16 (360/480) · 52 (768) · 40 (1024) · 1324 (1920).
 * Карточки: #262626 40 %, backdrop-blur 45.8, r40 → r64, p24 → p44, gap20 → gap40.
 * Светлого режима у лендинга в макете нет — тема форсирована классом theme-dark.
 */
export function Landing() {
  const t = useTranslations("landing");
  const page = useRef<HTMLDivElement>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const advantages = t.raw("advantages") as Card[];
  const pkg = t.raw("package.items") as Card[];
  const steps = t.raw("steps.items") as Card[];
  const support = t.raw("support.items") as Card[];
  const faq = t.raw("faq.items") as { q: string; a: string }[];

  // Пары иконок vuesax из макета: первая — брендовая, спереди; вторая — белая,
  // поверх неё в правом нижнем углу.
  const advantageIcons: [VuesaxName, VuesaxName][] = [
    ["mobile", "monitor"],
    ["like-shapes", "trend-up"],
    ["profile-2user", "user"],
  ];

  return (
    <div
      ref={page}
      className="theme-dark relative min-h-screen overflow-x-hidden bg-surface-page-bg"
    >
      <Glows container={page} />
      <GrainOverlay />

      <div className="relative z-10">
        <LandingHeader loginLabel={t("login")} />

        <Container>
          {/* ——— content 1 · герой ——— */}
          {/*
            До 768 макет ставит картинку первой и центрирует заголовок
            (фрейм 2153:196356: col gap40 cross:center, текст 32/500 center).
            С 768 — строка: текст слева, картинка справа.
          */}
          <section className="flex flex-col items-center gap-10 pt-8 md:flex-row md:items-end md:gap-10 md:pt-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.9,
                delay: 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-[180px] shrink-0 md:order-2 md:mx-0 md:w-[300px] lg:w-[354px] xl:w-[580px]"
            >
              <FloatImage src="/img/landing/hero.webp" tone="#F15A25" priority />
            </motion.div>

            <div className="min-w-0 flex-1 md:order-1">
              <HeroTitle
                lines={[t("hero.line1"), t("hero.line2"), t("hero.line3")]}
                coin={<CoinPill />}
                badge={<GradientPill>{t("hero.badge")}</GradientPill>}
              />
            </div>
          </section>

          {/* ——— content 2 · «Ecash — это сеть…» → карточки преимуществ ——— */}
          <Section>
            <SplitBlock
              image="/img/landing/tech.webp"
              tone="#5500FF"
              title={t("intro.title")}
              text={t("intro.text")}
              cta={t("intro.cta")}
              onCta={() => setContactOpen(true)}
            />

            <div className="mt-20 flex flex-col gap-5 md:mt-[120px] lg:mt-40 lg:gap-10">
              <div className="grid gap-5 md:grid-cols-2 lg:gap-10 xl:grid-cols-[456fr_704fr]">
                <GlassCard
                  card={advantages[0]}
                  icons={advantageIcons[0]}
                  index={0}
                />
                <GlassCard
                  card={advantages[1]}
                  icons={advantageIcons[1]}
                  index={1}
                />
              </div>
              <div className="grid gap-5 md:grid-cols-2 lg:gap-10 xl:grid-cols-[704fr_456fr]">
                <GlassCard
                  card={advantages[2]}
                  icons={advantageIcons[2]}
                  index={2}
                />
                <GlassCard card={advantages[3]} logo index={3} />
              </div>
            </div>
          </Section>

          {/* ——— content 3 · пакет франшизы ——— */}
          <Section>
            <SplitBlock
              reverse
              image="/img/landing/package.webp"
              tone="#FF0051"
              titleClassName="flex flex-wrap items-center justify-center gap-3 md:justify-start"
              titleNode={
                <>
                  <span>{t("package.titleLine1")}</span>
                  <OutlinePill>{t("package.titleLine2")}</OutlinePill>
                  <span>{t("package.titleAccent")}</span>
                  <LogoDot />
                </>
              }
              text={t("package.text")}
            />
            <CardRails
              items={pkg}
              perRail={3}
              className="mt-20 md:mt-[120px] lg:mt-40"
            />
          </Section>

          {/* ——— content 4 · этапы открытия ——— */}
          {/*
            ТЗ «Лендос Франшиза»: иконка-плашка (steps.png) раньше висела
            отдельным блоком под всеми карточками этапов, в самом низу секции —
            перенесена рядом с заголовком, тем же SplitBlock, что и у других секций.
          */}
          <Section>
            <SplitBlock
              image="/img/landing/steps.webp"
              tone="#F15A25"
              titleClassName="flex flex-wrap items-center justify-center gap-3 md:justify-start"
              titleNode={
                <>
                  <span>{t("steps.titleLine1")}</span>
                  <OutlinePill>{t("steps.titleLine2")}</OutlinePill>
                </>
              }
              text={t("steps.text")}
              leadClassName="min-[480px]:text-left"
            />

            {/*
              1920: ряды 704 + 456 и 456 + 704 попеременно. Сетка 456/208/456
              с гэпом 40 даёт ровно 1200, а карточка на две колонки — 704.
              До 1280 макет ставит две равные колонки.
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
          className="noise relative mt-40 overflow-hidden border-y border-white/10 bg-white/8 py-[100px] md:mt-[300px] lg:mt-[400px] lg:py-32 xl:py-[100px]"
        >
          {/*
            Фрейм 360 (2153:196380): col gap40, p100/20, cross:center —
            картинка сверху, под ней текст и форма во всю ширину.
          */}
          <Container className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-10 xl:gap-[164px]">
            <Appear className="shrink-0">
              <FloatImage
                src="/img/landing/contact.webp"
                tone="#9D00FF"
                delay={0.5}
                className="w-[160px] sm:w-[200px] lg:w-[354px] xl:w-[456px]"
              />
            </Appear>
            <Appear className="flex w-full min-w-0 flex-1 flex-col items-center text-center md:items-start md:text-left">
              <SectionTitle className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <span>{t("contact.titleLine1")}</span>
                <OutlinePill>{t("contact.titleLine2")}</OutlinePill>
                <span>{t("contact.titleLine3")}</span>
                <ToggleMark />
              </SectionTitle>
              <Lead className="lg:max-w-[704px]">{t("contact.text")}</Lead>
              {/*
                Кнопка из макета — 254×80, r102, p24/40, gap24, одинаковая на
                всех брейкпоинтах (мобильного варианта 66/r40 у неё нет).
                Заявку собирает ContactModal, поэтому полей здесь нет.
              */}
              <div className="mt-20 w-full text-left">
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  aria-haspopup="dialog"
                  className="group relative mx-auto flex h-20 w-[254px] cursor-pointer items-center justify-center gap-6 overflow-hidden rounded-[102px] bg-brand px-10 text-2xl leading-8 text-text-default shadow-[0_12px_40px_rgb(241_90_37/0.45)] transition-[box-shadow,filter] hover:shadow-[0_20px_64px_rgb(241_90_37/0.65)] hover:brightness-110 md:mx-0"
                >
                  {/* блик, пробегающий по кнопке при наведении */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -left-full w-1/2 skew-x-[-20deg] bg-white/25 blur-md transition-[left] duration-700 ease-out group-hover:left-[150%]"
                  />
                  {t("contact.cta")}
                  <Icon
                    name="arrow_forward"
                    size={32}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </button>
              </div>
            </Appear>
          </Container>
        </section>

        <Container>
          {/* ——— content 6 · поддержка партнёров ——— */}
          <Section>
            <SplitBlock
              image="/img/landing/support.webp"
              tone="#FF4200"
              title={t("support.title")}
              text={t("support.text")}
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
              <div className="rounded-[44px] border border-[#303030] bg-surface-page-surf1 p-5 lg:rounded-[64px] lg:p-16">
                <h2 className="text-2xl font-medium leading-tight text-text-default lg:text-[40px] lg:leading-[44px]">
                  {t("faq.title")}
                </h2>
                <div className="mt-8 flex flex-col gap-2 lg:mt-10">
                  {faq.map((item) => (
                    <FaqRow key={item.q} q={item.q} a={item.a} />
                  ))}
                </div>
              </div>
            </Appear>
          </Section>
        </Container>

        {/* общий футер сайта; лендингу нужен только свой ритм отбивки */}
        <Footer className="mt-40 md:mt-[300px] lg:mt-[400px]" />
      </div>

      <ScrollToTopButton label={t("scrollTop")} />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}

/**
 * Круглая 3D-кнопка «наверх»: глянцевый шар в брендовом градиенте с двойной
 * внутренней тенью (блик сверху-слева, затемнение снизу-справа) — появляется
 * после прокрутки. Кнопка всегда в DOM, видимость переключается через CSS
 * (opacity/translate), а не unmount/mount — чистый transition, без риска
 * «зависнуть» невидимой, если вкладка уйдёт в фон в момент появления.
 */
function ScrollToTopButton({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={label}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={clsx(
        "fixed bottom-6 right-6 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#ff9466,var(--color-brand)_58%,#c2410c_100%)] text-text-always-white shadow-[0_14px_32px_rgb(241_90_37/0.55),inset_0_2px_3px_rgb(255_255_255/0.45),inset_0_-6px_10px_rgb(0_0_0/0.28)] transition-all duration-300 ease-out hover:brightness-110 active:scale-95 md:bottom-10 md:right-10",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <Icon name="arrow_upward" size={26} />
    </button>
  );
}

/* --------------------------------------------------------------- раскладка */

/** Паддинги страницы: 16 (≤480) · 52 (768) · 40 (1024) · колонка 1324 (1920). */
function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "relative mx-auto w-full max-w-[1324px] px-4 md:px-[52px] lg:px-10 xl:px-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Межсекционный отступ 160 → 300 → 400 (как в ecash-beta). */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative pt-40 md:pt-[300px] lg:pt-[400px]">
      {children}
    </section>
  );
}

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
        "font-medium text-text-default",
        alwaysLarge
          ? "text-[40px] leading-[44px]"
          : "text-[32px] leading-[1.2] md:text-[40px] md:leading-[44px]",
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
 * tight — зазор заголовок→лид 20 вместо 32.
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
        "text-lg leading-5 text-text-default",
        tight ? "mt-5 md:mt-8" : "mt-8",
        upFrom === 480
          ? "min-[480px]:text-2xl min-[480px]:leading-8"
          : "md:text-2xl md:leading-8",
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
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
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
  const reduced = useReducedMotion();

  /**
   * Маска строки нужна только на время выезда снизу. Дальше её снимаем:
   * свечение под монеткой (shadow 44px) выходит за строку и упиралось
   * в overflow-hidden — сверху и снизу ореол срезало по прямой.
   *
   * useReducedMotion на первом рендере отдаёт null, поэтому reduced учитываем
   * отдельным слагаемым: без анимации onAnimationComplete не сработает и
   * маска осталась бы навсегда.
   */
  const [revealed, setRevealed] = useState(false);
  const unclipped = revealed || !!reduced;

  // С 768 монетка стоит справа от второй строки, плашка — от третьей.
  // До 768 макет даёт только центрированный заголовок, плашка уходит под него.
  const trailing = [null, coin, badge];

  return (
    <>
      <h1 className="text-[32px] font-medium leading-[1.2] text-text-default md:text-5xl md:font-bold md:leading-none md:tracking-tight xl:text-[96px]">
        {lines.map((line, i) => (
          <span
            key={line}
            className={clsx("block pb-1", !unclipped && "overflow-hidden")}
          >
            <motion.span
              className="flex flex-wrap items-center justify-center gap-3 md:justify-start xl:gap-6"
              initial={reduced ? undefined : { y: "110%" }}
              animate={reduced ? undefined : { y: 0 }}
              transition={{
                duration: 0.75,
                delay: 0.1 + i * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              onAnimationComplete={
                i === lines.length - 1 ? () => setRevealed(true) : undefined
              }
            >
              {line}
              <span className="hidden md:contents">{trailing[i]}</span>
            </motion.span>
          </span>
        ))}
      </h1>

      {/* мобильный вариант: монетка и плашка под центрированным заголовком */}
      <motion.div
        initial={reduced ? undefined : { opacity: 0, y: 12 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-3 md:hidden"
      >
        {badge}
        {coin}
      </motion.div>
    </>
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
    <span className="inline-flex rounded-[50px] bg-[linear-gradient(135deg,#F6844B,#BF5AF5)] p-[2px] align-middle shadow-[0_0_28px_rgb(191_90_245/0.3)] xl:p-[3px]">
      <span className="inline-flex items-center rounded-[48px] bg-surface-page-bg px-4 py-1.5 text-sm font-bold leading-[1.25] tracking-normal text-text-default sm:px-5 sm:py-2 sm:text-base xl:text-xl">
        {children}
      </span>
    </span>
  );
}

/**
 * Кант 2 px градиентом #F6844B → #BF5AF5 поверх прозрачного фона.
 * Обычный border-image сломал бы фон секции под плашкой, поэтому рамка
 * рисуется псевдоэлементом с маской — как у карточек (.glass-accent).
 */
const RING_2PX = [
  "relative before:pointer-events-none before:absolute before:inset-0",
  "before:rounded-[inherit] before:p-[2px] before:content-['']",
  "before:[background:var(--gradient-accent)]",
  // только длинные свойства: сокращение mask сбрасывает mask-composite,
  // а порядок утилит в собранном CSS не гарантирован
  "before:[-webkit-mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)]",
  "before:[mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)]",
  "before:[-webkit-mask-clip:content-box,border-box]",
  "before:[mask-clip:content-box,border-box]",
  "before:[-webkit-mask-composite:xor] before:[mask-composite:exclude]",
].join(" ");

/**
 * Плашка-пилюля вокруг акцентного слова заголовка: r30, p2/20/8/20,
 * обводка 2px градиентом. Текст внутри — обычный #EEEEEE.
 */
function OutlinePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        // с 768 в макете плашка 58 при строке 44 — высоту задаём явно,
        // иначе паддинги 2/8 дают 54 и заголовок садится на 4 px выше
        "inline-flex items-center rounded-[30px] px-5 pb-2 pt-0.5 md:min-h-[58px]",
        // strokeAlign=INSIDE: с 768 макет считает кант 2 px частью габарита,
        // а до 480 — нет, поэтому +2 только с md
        "md:px-[22px]",
        RING_2PX,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Фирменный кружок после слова «Ecash» в заголовке «Что входит в пакет»:
 * 54×54, r43.2, #F15A25 с белым знаком 22.63×32.4.
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
 * Декоративный «переключатель» в конце заголовка секции контактов:
 * 84×44, r28, обводка 2 #EEEEEE, кружок 28×28 #F15A25 у правого края.
 */
function ToggleMark() {
  return (
    <span className="inline-flex h-11 w-[84px] shrink-0 items-center justify-end rounded-[28px] border-2 border-text-default pr-1.5">
      <span className="block h-7 w-7 rounded-full bg-brand" />
    </span>
  );
}

/**
 * Монетка ecash в пилюле — logo 124×64, r51.2 из макета: фон белый,
 * фирменный знак — брендовым оранжевым (ТЗ «Лендос Франшиза»: раньше
 * было наоборот — оранжевый фон и белый знак).
 */
function CoinPill() {
  return (
    <motion.span
      whileHover={{ scale: 1.06, rotate: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className="inline-flex h-10 w-[68px] shrink-0 items-center justify-center rounded-[51px] bg-white shadow-[0_0_44px_rgb(241_90_37/0.35)] md:h-[52px] md:w-[96px] xl:h-16 xl:w-[124px]"
    >
      <img
        src="/img/mark-orange.webp"
        alt=""
        width={113}
        height={160}
        className="h-6 w-auto md:h-8 xl:h-[38px]"
      />
    </motion.span>
  );
}

/**
 * Сплит-блок: картинка + текст. 1920 — в строку с зазором 164,
 * 1024 — 40, мобильный — колонка с картинкой сверху.
 */
function SplitBlock({
  image,
  tone,
  title,
  titleNode,
  titleClassName,
  text,
  leadClassName,
  cta,
  onCta,
  reverse,
}: {
  image: string;
  /** цвет ореола под картинкой — под свечение своей секции */
  tone: string;
  title?: string;
  titleNode?: React.ReactNode;
  /** раскладка заголовка, когда он собран из плашек, а не из одной строки */
  titleClassName?: string;
  text: string;
  leadClassName?: string;
  cta?: string;
  /** есть только у секции с кнопкой «Связаться» — открывает ContactModal */
  onCta?: () => void;
  reverse?: boolean;
}) {
  return (
    <div
      className={clsx(
        "relative flex flex-col items-center gap-5 lg:gap-10 xl:gap-[164px]",
        reverse ? "lg:flex-row-reverse" : "lg:flex-row",
      )}
    >
      <Appear className="shrink-0">
        <FloatImage
          src={image}
          tone={tone}
          className="w-[184px] lg:w-[354px] xl:w-[456px]"
        />
      </Appear>
      <Appear delay={0.08} className="min-w-0 flex-1 text-center md:text-left">
        <SectionTitle className={titleClassName}>
          {titleNode ?? title}
        </SectionTitle>
        <Lead className={leadClassName}>{text}</Lead>
        {cta && (
          <CtaButton className="mt-8 md:mt-10 lg:mt-14" onClick={onCta}>
            {cta}
          </CtaButton>
        )}
      </Appear>
    </div>
  );
}

/* --------------------------------------------------------------- элементы */

/** Шапка: ≤768 сплошная #262626; ≥1024 стекло #FFFFFF 8 %. */
function LandingHeader({ loginLabel }: { loginLabel: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-divider-elevated bg-surface-page-surf1 lg:border-white/12 lg:bg-white/8 lg:backdrop-blur-2xl">
      <Container className="flex h-[75px] items-center justify-between lg:h-[83px]">
        <Link
          href="/"
          aria-label="ecash"
          className="transition-opacity hover:opacity-80"
        >
          <Logo tone="onDark" className="scale-90 origin-left sm:scale-100" />
        </Link>
        <Link
          href="/login"
          className="inline-flex h-[50px] items-center gap-2 rounded-2xl bg-btn-1 px-4 text-base font-medium text-text-default transition-colors hover:bg-comp-surface2-hover lg:bg-white/8 lg:px-6 lg:hover:bg-white/15"
        >
          {loginLabel}
          <Icon name="login" size={20} />
        </Link>
      </Container>
    </header>
  );
}

/** Матовое стекло: #262626 40 %, backdrop-blur 45.8, r40 → r64, p24 → p44. */
function GlassCard({
  card,
  icons,
  logo,
  index,
}: {
  card: Card;
  icons?: [VuesaxName, VuesaxName];
  logo?: boolean;
  index: number;
}) {
  const accent = Boolean(card.accent);
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? undefined : { opacity: 0, y: 28 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.55,
        delay: (index % 2) * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduced ? undefined : { y: -6 }}
      className="h-full"
    >
      <Spotlight
        tone={accent ? "#BF5AF5" : "#F6844B"}
        className={clsx(
          "group flex h-full flex-col gap-5 rounded-[40px] bg-[#262626]/40 p-6 glass-blur md:p-9 lg:gap-10 lg:rounded-[64px] lg:p-11",
          // 2153:195603 — у акцентной карточки кант градиентный, у остальных #303030
          accent ? "glass-accent" : "border border-[#303030]",
        )}
      >
        {logo ? (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_0_40px_rgb(241_90_37/0.35)] transition-transform duration-300 group-hover:scale-110 lg:h-[72px] lg:w-[72px]">
            <img
              src="/img/mark-orange.webp"
              alt=""
              width={113}
              height={160}
              className="h-8 w-auto lg:h-[43px]"
            />
          </span>
        ) : (
          icons && (
            <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[24px] border-2 border-[#616161] transition-colors duration-300 group-hover:border-brand md:h-[100px] md:w-[100px] md:rounded-[32px]">
              {/* 2153:195575 — пара иконок 48×48 в блоке 72×72; на 480/360 — 21.33 в 32 */}
              <span className="relative h-8 w-8 md:h-[72px] md:w-[72px]">
                <VuesaxIcon
                  name={icons[0]}
                  className="absolute left-0 top-0 h-[21.33px] w-[21.33px] text-brand drop-shadow-[0_0_12px_rgb(241_90_37/0.6)] transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 md:h-12 md:w-12"
                />
                <VuesaxIcon
                  name={icons[1]}
                  className="absolute bottom-0 right-0 h-[21.33px] w-[21.33px] text-text-default transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5 md:h-12 md:w-12"
                />
              </span>
            </span>
          )
        )}

        <div className="flex flex-col gap-6">
          <h3
            className={clsx(
              "text-xl font-medium leading-7 md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]",
              accent ? "text-text-brand" : "text-text-default",
            )}
          >
            {card.title}
          </h3>
          <p
            className={clsx(
              "text-base leading-[1.24] md:text-xl md:leading-8",
              accent ? "text-text-brand" : "text-text-default",
            )}
          >
            {card.text}
          </p>
        </div>
      </Spotlight>
    </motion.div>
  );
}

/**
 * Карточка этапа: номер 50×50 r16 на #303030 с градиентным кантом.
 * На 1920 ряды идут 704 + 456 и 456 + 704 — это span 2 у элементов 0, 3, 4, …
 * Кант номера при наведении на карточку заливается брендовым оранжевым
 * вместе с плашкой (grad-border-brand-hover).
 */
function StepCard({ step, index }: { step: Card; index: number }) {
  const reduced = useReducedMotion();
  const wide = index % 4 === 0 || index % 4 === 3;

  return (
    <motion.article
      initial={reduced ? undefined : { opacity: 0, y: 28 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: (index % 2) * 0.08 }}
      whileHover={reduced ? undefined : { y: -6 }}
      className={clsx(
        "glass-veil group h-full rounded-[64px] p-9 glass-blur lg:p-11",
        wide && "xl:col-span-2",
      )}
    >
      <span className="grad-border grad-border-brand-hover inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl bg-[#303030] text-lg font-medium leading-6 text-text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-text-always-white">
        {index + 1}
      </span>
      <h3 className="mt-6 text-xl font-medium leading-7 text-text-default min-[480px]:text-[28px] min-[480px]:font-semibold min-[480px]:leading-8 min-[480px]:tracking-[-0.45px] lg:mt-11">
        {step.title}
      </h3>
      <p className="mt-6 text-base leading-[1.24] text-text-default min-[480px]:text-xl min-[480px]:leading-8">
        {step.text}
      </p>
    </motion.article>
  );
}

/**
 * Кнопка макета: 254×80, r102, p24/40, gap24, текст 24/400.
 * С onClick — открывает модалку (button), без — якорь-скролл к форме (a).
 */
function CtaButton({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const cls =
    "group relative inline-flex h-14 cursor-pointer items-center gap-4 overflow-hidden rounded-[102px] bg-brand px-8 text-base leading-8 text-text-default shadow-[0_12px_40px_rgb(241_90_37/0.45)] transition-[box-shadow,filter] hover:shadow-[0_20px_64px_rgb(241_90_37/0.65)] hover:brightness-110 lg:h-20 lg:gap-6 lg:px-10 lg:text-2xl";
  const inner = (
    <>
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
    </>
  );

  return (
    <Magnetic className={clsx("inline-block", className)}>
      {onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      ) : (
        <a href="#lead" className={cls}>
          {inner}
        </a>
      )}
    </Magnetic>
  );
}

/**
 * Ряды карточек («complex slider»): по 3 (пакет) или 6 (поддержка) в ряд.
 * Ряд горизонтальный на всех ширинах — в макете это scroll container колонки.
 * Ширина карточки равна колонке до 768, 429 на 768, 704 (пакет) / 580
 * (поддержка) с 1024. Зазор 12 → 20 → 40.
 */
function CardRails({
  items,
  perRail,
  variant = "package",
  className,
}: {
  items: Card[];
  perRail: number;
  /** «package» — карточки 704 (content 3); «support» — 580 (content 6).
   *  Оформление одинаковое: чередование стекла и плотной заливки с кантом. */
  variant?: "package" | "support";
  className?: string;
}) {
  const rails: Card[][] = [];
  for (let i = 0; i < items.length; i += perRail)
    rails.push(items.slice(i, i + perRail));

  return (
    <div className={clsx("flex flex-col gap-5 lg:gap-10", className)}>
      {rails.map((rail, railIndex) => (
        <Rail key={railIndex} cards={rail} variant={variant} />
      ))}
    </div>
  );
}

/**
 * Один ряд-карусель.
 *
 * Карточка — доля КОЛОНКИ, а не пиксели из макета: 1 карточка в кадре до
 * 768, 2 дальше. Доля посчитана так, что N карточек плюс (N-1) зазоров дают
 * РОВНО 100 % ширины — ряд всегда заполняет колонку целиком, без пустого
 * места справа и без огрызка карточки на срезе, на любой ширине экрана, не
 * только на нескольких проверенных вручную.
 *
 * Карточек в ряду больше, чем видно за раз (3 или 6), — лишние остаются за
 * кадром и открываются свайпом/скроллом, ряд размечен как настоящий
 * scroll-snap-контейнер. Технических ухищрений (замер в JS, CSS-переменные,
 * подгонка окна под целое число карточек) больше нет: формула сама по себе
 * не может оставить дробную карточку у края, потому что делит без остатка.
 *
 * Раньше карточка была жёстко 704/580px из дампа Figma — тогда любая ширина
 * экрана, не кратная точно этому числу, оставляла либо пустой хвост колонки,
 * либо срез следующей карточки. Пиксель-в-пиксель это было точно по макету,
 * но заказчик явно потребовал ряд БЕЗ пустот и БЕЗ огрызков на любой
 * ширине — этим пришлось пожертвовать точным числом ради самого требования.
 * Карусель (свайп, «лишние» карточки за кадром) макету по-прежнему верна —
 * у узла-обёртки в дампе стоит overflowDirection: HORIZONTAL_SCROLLING.
 */
function Rail({ cards, variant }: { cards: Card[]; variant: "package" | "support" }) {
  const reduced = useReducedMotion();

  return (
    /*
      Появление — на РЯДЕ, а не на карточках. Раньше каждая карточка гасла до
      opacity 0 и оживала по своему пересечению с вьюпортом, но у соседа в
      кадре всего ~22px кромки, а порог был margin: -40px — сосед не
      пересекался и оставался невидимым.
    */
    <motion.div
      initial={reduced ? undefined : { opacity: 0, y: 20 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45 }}
      /*
       * overflow-x:auto по спецификации делает и overflow-y:auto, поэтому
       * ряд обрезает всё, что выходит за его границы: подъём карточки на
       * ховере и её тень. -mt-8 pt-8 / -mb-24 pb-24 дают вертикальный запас
       * (тень вниз до 44px, подъём 6px) и гасят друг друга, не сдвигая сам
       * ряд. Горизонтального запаса нет: он оставил бы у правого края щель
       * ровно в свою ширину, то есть то самое пустое место, от которого весь
       * этот проход и избавляется.
       */
      className="-mt-8 -mb-24 flex snap-x snap-mandatory flex-row gap-3 overflow-x-auto pb-24 pt-8 [scrollbar-width:none] md:gap-5 lg:gap-10 [&::-webkit-scrollbar]:hidden"
    >
      {cards.map((item, i) => (
        <RailCard key={item.title} item={item} index={i} variant={variant} />
      ))}
    </motion.div>
  );
}

function RailCard({
  item,
  index,
  variant = "package",
}: {
  item: Card;
  index: number;
  variant?: "package" | "support";
}) {
  const reduced = useReducedMotion();
  const support = variant === "support";

  /**
   * Заливки из макета.
   * Пакет: 0 — плотная #262626 60 % с градиентным кантом, 1 — стекло с белым
   * кантом, 2 — стекло с градиентным кантом.
   * Поддержка: чётные — стекло, нечётные — плотная заливка с градиентным кантом.
   */
  const dense = support ? index % 2 === 1 : index % 3 === 0;
  const gradient = support ? index % 2 === 1 : index % 3 !== 1;

  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -6 }}
      /*
        Ширина — доля колонки: 1 карточка в кадре до 768, 2 дальше. Формула —
        (100% минус зазоры между видимыми карточками) делённое на их число,
        поэтому N карточек + (N-1) зазор всегда дают ровно 100%: ни пустого
        хвоста колонки, ни огрызка карточки на срезе не остаётся ни на одной
        ширине экрана. Зазоры взяты те же, что у gap самого ряда (12→20→40).
      */
      className={clsx(
        "w-full shrink-0 snap-start",
        "md:w-[calc((100%-20px)/2)] lg:w-[calc((100%-40px)/2)]",
      )}
    >
      <Spotlight
        tone={gradient ? "#BF5AF5" : "#F6844B"}
        className={clsx(
          "flex h-full flex-col gap-6 rounded-[64px] p-9 glass-blur lg:gap-11 lg:p-16",
          dense ? "glass-dense" : "glass-veil",
          gradient && "glass-accent",
        )}
      >
        <h3 className="text-xl font-medium leading-7 text-text-default md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]">
          {item.title}
        </h3>
        <p className="text-base leading-[1.24] text-text-default md:text-xl md:leading-8">
          {item.text}
        </p>
      </Spotlight>
    </motion.div>
  );
}

/** Спойлер FAQ: p44 r64 на #303030, разделитель #454545. */
function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={clsx(
        "rounded-[24px] bg-[#303030] px-5 py-4 transition-colors duration-300 lg:rounded-[64px] lg:px-11 lg:py-8",
        open ? "bg-[#3b3b3b]" : "hover:bg-[#363636]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 text-left"
      >
        <span className="min-w-0 flex-1 text-base font-semibold leading-8 tracking-[-0.45px] text-text-default lg:text-[28px]">
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className={clsx(
            "flex shrink-0 transition-colors",
            open && "text-text-brand",
          )}
        >
          <Icon name="keyboard_arrow_down" size={24} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-6 border-t border-[#454545] pt-6 text-base leading-8 text-text-default lg:text-xl">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
