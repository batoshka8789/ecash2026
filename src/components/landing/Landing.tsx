"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { LeadForm } from "./LeadForm";
import { Glows } from "./Glows";
import { FloatImage, GrainOverlay, Magnetic, Spotlight } from "./effects";

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

  const advantages = t.raw("advantages") as Card[];
  const pkg = t.raw("package.items") as Card[];
  const steps = t.raw("steps.items") as Card[];
  const support = t.raw("support.items") as Card[];
  const faq = t.raw("faq.items") as { q: string; a: string }[];

  // Пары иконок vuesax из макета
  const advantageIcons: [string, string][] = [
    ["smartphone", "monitor"],
    ["favorite", "trending_up"],
    ["group", "person"],
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
              <FloatImage src="/img/landing/hero.png" tone="#F15A25" />
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
              image="/img/landing/tech.png"
              tone="#5500FF"
              title={t("intro.title")}
              text={t("intro.text")}
              cta={t("intro.cta")}
            />

            <div className="mt-20 flex flex-col gap-5 md:mt-24 lg:mt-[120px] lg:gap-10 xl:mt-[140px]">
              <div className="grid gap-5 lg:grid-cols-[456fr_704fr] lg:gap-10">
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
              <div className="grid gap-5 lg:grid-cols-[704fr_456fr] lg:gap-10">
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
              image="/img/landing/package.png"
              tone="#FF0051"
              titleNode={
                <>
                  {t("package.titleLine1")}
                  <br />
                  {t("package.titleLine2")}{" "}
                  <span className="text-gradient">
                    {t("package.titleAccent")}
                  </span>
                </>
              }
              text={t("package.text")}
            />
            <CardRails
              items={pkg}
              perRail={3}
              className="mt-20 md:mt-24 lg:mt-[120px] xl:mt-[140px]"
            />
          </Section>

          {/* ——— content 4 · этапы открытия ——— */}
          <Section>
            <Appear>
              <SectionTitle>
                {t("steps.titleLine1")}
                <br />
                {t("steps.titleLine2")}
              </SectionTitle>
              <Lead className="max-w-[704px]">{t("steps.text")}</Lead>
            </Appear>

            <div className="mt-12 grid gap-5 md:mt-16 lg:mt-[120px] lg:grid-cols-2 lg:gap-10">
              {steps.map((s, i) => (
                <StepCard key={s.title} step={s} index={i} />
              ))}
            </div>

            <Appear className="mt-16 flex justify-center md:mt-20 lg:mt-28">
              <FloatImage
                src="/img/landing/steps.png"
                tone="#F15A25"
                delay={0.3}
                className="w-full max-w-[580px]"
              />
            </Appear>
          </Section>
        </Container>

        {/* ——— content 5 · баннер «Свяжитесь…» ——— */}
        <section
          id="lead"
          className="noise relative mt-28 overflow-hidden border-y border-white/10 bg-white/8 py-20 md:mt-36 md:py-24 lg:mt-[180px] lg:py-[120px] xl:mt-[220px]"
        >
          {/*
            Фрейм 360 (2153:196380): col gap40, p100/20, cross:center —
            картинка сверху, под ней текст и форма во всю ширину.
          */}
          <Container className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-10 xl:gap-[164px]">
            <Appear className="shrink-0">
              <FloatImage
                src="/img/landing/contact.png"
                tone="#9D00FF"
                delay={0.5}
                className="w-[160px] sm:w-[200px] lg:w-[354px] xl:w-[456px]"
              />
            </Appear>
            <Appear className="flex w-full min-w-0 flex-1 flex-col items-center text-center lg:items-start lg:text-left">
              <SectionTitle>
                {t("contact.titleLine1")}{" "}
                <span className="text-gradient">{t("contact.titleLine2")}</span>
                {t("contact.titleLine3")}
              </SectionTitle>
              <Lead className="max-w-[704px]">{t("contact.text")}</Lead>
              <LeadForm cta={t("contact.cta")} />
            </Appear>
          </Container>
        </section>

        <Container>
          {/* ——— content 6 · поддержка партнёров ——— */}
          <Section>
            <SplitBlock
              image="/img/landing/support.png"
              tone="#FF4200"
              title={t("support.title")}
              text={t("support.text")}
            />
            <CardRails
              items={support}
              perRail={6}
              className="mt-20 xl:mt-[160px]"
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

        <LandingFooter />
      </div>
    </div>
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

/** Межсекционный отступ 80 → 160. */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative pt-28 md:pt-36 lg:pt-[180px] xl:pt-[220px]">
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-medium leading-tight text-text-default lg:text-[40px] lg:leading-[44px]">
      {children}
    </h2>
  );
}

function Lead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "mt-5 text-base leading-8 text-text-default lg:mt-8 lg:text-2xl",
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

  // С 768 монетка стоит справа от второй строки, плашка — от третьей.
  // До 768 макет даёт только центрированный заголовок, плашка уходит под него.
  const trailing = [null, coin, badge];

  return (
    <>
      <h1 className="text-[32px] font-medium leading-[1.2] text-text-default md:text-5xl md:font-bold md:leading-none md:tracking-tight xl:text-[96px]">
        {lines.map((line, i) => (
          <span key={line} className="block overflow-hidden pb-1">
            <motion.span
              className="flex flex-wrap items-center justify-center gap-3 md:justify-start xl:gap-6"
              initial={reduced ? undefined : { y: "110%" }}
              animate={reduced ? undefined : { y: 0 }}
              transition={{
                duration: 0.75,
                delay: 0.1 + i * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
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
 * Монетка ecash в пилюле — logo 124×64, r51.2, fill #F15A25 из макета.
 * Внутри белый фирменный знак (Vector 26.82×38.4).
 */
function CoinPill() {
  return (
    <motion.span
      whileHover={{ scale: 1.06, rotate: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className="inline-flex h-10 w-[68px] shrink-0 items-center justify-center rounded-[51px] bg-brand shadow-[0_0_44px_rgb(241_90_37/0.5)] md:h-[52px] md:w-[96px] xl:h-16 xl:w-[124px]"
    >
      <img
        src="/img/mark-white.png"
        alt=""
        width={111}
        height={159}
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
  text,
  cta,
  reverse,
}: {
  image: string;
  /** цвет ореола под картинкой — под свечение своей секции */
  tone: string;
  title?: string;
  titleNode?: React.ReactNode;
  text: string;
  cta?: string;
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
      <Appear delay={0.08} className="min-w-0 flex-1 text-center lg:text-left">
        <SectionTitle>{titleNode ?? title}</SectionTitle>
        <Lead>{text}</Lead>
        {cta && <CtaButton className="mt-8 md:mt-10 lg:mt-14">{cta}</CtaButton>}
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

/** Футер: #333333, border #303030. */
function LandingFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="relative mt-28 border-t border-[#303030] bg-surface-modal-bg md:mt-36 lg:mt-[180px] xl:mt-[220px]">
      <Container className="py-8 lg:py-[60px] xl:pt-[100px]">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 xl:gap-[263px]">
          <div className="flex flex-col gap-6">
            <div className="flex gap-2">
              <SocialLink href="https://wa.me/77059089073" label="WhatsApp">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.1 4c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.4 3.9 2.2.9 2.6.7 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.2-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.5-.6c.1-.2.1-.3.2-.5v-.4L10.3 8c-.1-.3-.3-.3-.5-.3h-.4l-.5.1Z" />
                </svg>
              </SocialLink>
              <SocialLink href="https://t.me/ecash" label="Telegram">
                <Icon name="send" size={18} filled />
              </SocialLink>
            </div>
            <a
              href="tel:+77059089073"
              className="text-xl leading-8 text-text-default transition-colors hover:text-text-brand"
            >
              +7 (705) 908 90 73
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xl leading-8 text-text-disabled">
              {t("schedule")}
            </div>
            <div className="text-xl leading-8 text-text-default">
              {t("scheduleValue")}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xl leading-8 text-text-disabled">
              {t("additional")}
            </div>
            <span className="inline-flex items-center gap-2 text-xl leading-8 text-text-default">
              {t("documents")}
              <Icon name="arrow_outward" size={20} />
            </span>
          </div>
        </div>

        <div className="mt-12 text-base leading-8 text-text-default lg:mt-20 lg:text-xl">
          © {new Date().getFullYear()}. {t("rights")}
        </div>
      </Container>
    </footer>
  );
}

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
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-btn-2 text-text-default transition-colors hover:bg-comp-surface2-hover"
    >
      {children}
    </motion.a>
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
  icons?: [string, string];
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
          "group flex h-full flex-col gap-5 rounded-[40px] p-6 backdrop-blur-[46px] lg:gap-10 lg:rounded-[64px] lg:p-11",
          accent ? "glass-dense glass-accent" : "glass",
        )}
      >
        {logo ? (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand shadow-[0_0_40px_rgb(241_90_37/0.5)] transition-transform duration-300 group-hover:scale-110 lg:h-[72px] lg:w-[72px]">
            <img
              src="/img/mark-white.png"
              alt=""
              width={111}
              height={159}
              className="h-8 w-auto lg:h-[43px]"
            />
          </span>
        ) : (
          icons && (
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-[24px] border-2 border-[#616161] transition-colors duration-300 group-hover:border-brand lg:h-[100px] lg:w-[100px] lg:rounded-[32px]">
              <span className="relative h-[52px] w-[52px] lg:h-[72px] lg:w-[72px]">
                <Icon
                  name={icons[0]}
                  filled
                  className="absolute left-0 top-0 text-[34px] text-brand drop-shadow-[0_0_12px_rgb(241_90_37/0.6)] transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 lg:text-[48px]"
                />
                <Icon
                  name={icons[1]}
                  filled
                  className="absolute bottom-0 right-0 text-[34px] text-text-default transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5 lg:text-[48px]"
                />
              </span>
            </span>
          )
        )}

        <div className="flex flex-col gap-5 lg:gap-6">
          <h3
            className={clsx(
              "text-lg font-semibold leading-8 tracking-[-0.45px] lg:text-[28px]",
              accent ? "text-text-brand" : "text-text-default",
            )}
          >
            {card.title}
          </h3>
          <p
            className={clsx(
              "text-base leading-8 lg:text-xl",
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

/** Карточка этапа с номером в кружке. */
function StepCard({ step, index }: { step: Card; index: number }) {
  const reduced = useReducedMotion();

  return (
    <motion.article
      initial={reduced ? undefined : { opacity: 0, y: 28 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: (index % 2) * 0.08 }}
      whileHover={reduced ? undefined : { y: -6 }}
      className="glass group h-full rounded-[40px] p-6 backdrop-blur-[46px] lg:rounded-[64px] lg:p-11"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-hardsoft text-lg font-medium text-text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-text-always-white">
        {index + 1}
      </span>
      <h3 className="mt-5 text-lg font-semibold leading-8 tracking-[-0.45px] text-text-default lg:mt-10 lg:text-[28px]">
        {step.title}
      </h3>
      <p className="mt-5 text-base leading-8 text-text-default lg:mt-6 lg:text-xl">
        {step.text}
      </p>
    </motion.article>
  );
}

/** Кнопка макета: 254×80, r102, p24/40, gap24, текст 24/400. */
function CtaButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Magnetic className={clsx("inline-block", className)}>
      <a
        href="#lead"
        className="group relative inline-flex h-14 cursor-pointer items-center gap-4 overflow-hidden rounded-[102px] bg-brand px-8 text-base leading-8 text-text-default shadow-[0_12px_40px_rgb(241_90_37/0.45)] transition-[box-shadow,filter] hover:shadow-[0_20px_64px_rgb(241_90_37/0.65)] hover:brightness-110 lg:h-20 lg:gap-6 lg:px-10 lg:text-2xl"
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
 * Ряды карточек («complex slider»): по 3 (пакет) или 6 (поддержка) в ряд.
 * Карточка 704×334, p64, gap44, r64. Ряды сдвинуты в разные стороны при
 * скролле — так они «живут», как в прототипе.
 */
function CardRails({
  items,
  perRail,
  className,
}: {
  items: Card[];
  perRail: number;
  className?: string;
}) {
  const rails: Card[][] = [];
  for (let i = 0; i < items.length; i += perRail)
    rails.push(items.slice(i, i + perRail));

  return (
    <div className={clsx("flex flex-col gap-5 lg:gap-10", className)}>
      {rails.map((rail, railIndex) => (
        <div
          key={railIndex}
          className="flex flex-col gap-5 lg:-mx-10 lg:snap-x lg:snap-mandatory lg:flex-row lg:gap-10 lg:overflow-x-auto lg:px-10 lg:pb-2 lg:[scrollbar-width:none] xl:mx-0 xl:px-0 lg:[&::-webkit-scrollbar]:hidden"
        >
          {rail.map((item, i) => (
            <RailCard key={item.title} item={item} index={i} />
          ))}
        </div>
      ))}
    </div>
  );
}

function RailCard({ item, index }: { item: Card; index: number }) {
  const reduced = useReducedMotion();
  const gradient = index % 3 !== 1;

  return (
    <motion.div
      initial={reduced ? undefined : { opacity: 0, y: 20 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index, 3) * 0.07 }}
      whileHover={reduced ? undefined : { y: -6 }}
      className="lg:w-[704px] lg:shrink-0 lg:snap-start"
    >
      <Spotlight
        tone={gradient ? "#BF5AF5" : "#F6844B"}
        className={clsx(
          "flex h-full flex-col gap-5 rounded-[40px] p-6 backdrop-blur-[46px] lg:gap-11 lg:rounded-[64px] lg:p-16",
          index % 3 === 0 ? "glass-dense" : "glass",
          gradient && "glass-accent",
        )}
      >
        <h3 className="text-lg font-semibold leading-8 tracking-[-0.45px] text-text-default lg:text-[28px]">
          {item.title}
        </h3>
        <p className="text-base leading-8 text-text-default lg:text-xl">
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
