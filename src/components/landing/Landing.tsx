"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
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
 * Паддинги страницы из фреймов: 20 (360/480/768) · 40 (1024) · колонка 1200
 * внутри бокса 1448 (1920). Отступ между секциями: 160 · 300 · 400 · 400.
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
          <section className="flex flex-col items-center gap-10 md:flex-row md:items-end md:gap-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.9,
                delay: 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-[166px] shrink-0 md:order-2 md:mx-0 md:w-[344px] lg:w-[452px] xl:-mr-[124px] xl:w-[580px]"
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
              className="mt-20 md:mt-[120px] lg:mt-40"
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
              <Lead className="lg:max-w-[580px]">{t("steps.text")}</Lead>
            </Appear>

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
          className="noise relative mt-40 overflow-hidden bg-white/8 py-[100px] md:mt-[300px] lg:mt-[400px] lg:py-32 xl:py-[100px]"
        >
          {/*
            Фрейм 360 (2153:196380): col gap40, p100/20, cross:center —
            картинка сверху, под ней текст и форма во всю ширину.
          */}
          <Container className="flex flex-col items-center gap-10 md:flex-row md:items-center md:gap-[60px] lg:gap-10 xl:gap-[164px]">
            <Appear className="shrink-0 xl:-ml-[124px]">
              <FloatImage
                src="/img/landing/contact.png"
                tone="#9D00FF"
                delay={0.5}
                className="w-[184px] md:w-[238px] lg:w-[354px] xl:w-[456px]"
              />
            </Appear>
            <Appear className="flex w-full min-w-0 flex-1 flex-col items-center text-center md:items-start md:text-left">
              <SectionTitle>
                {t("contact.titleLine1")}{" "}
                <span className="text-gradient">{t("contact.titleLine2")}</span>
                {t("contact.titleLine3")}
              </SectionTitle>
              <Lead className="lg:max-w-[704px]">{t("contact.text")}</Lead>
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
              variant="support"
              className="mt-20 md:mt-[120px] lg:mt-40"
            />
          </Section>

          {/* ——— content 7 · FAQ ——— */}
          <Section>
            <Appear>
              {/* 1920 (2153:195430): блок 1448 — колонка 1200 плюс вынос 124 по краям */}
              <div className="rounded-[44px] border border-[#303030] bg-surface-page-surf1 p-5 md:rounded-[64px] md:p-9 lg:p-16 xl:-mx-[124px]">
                <h2 className="text-[32px] font-medium leading-[1.2] text-text-default md:text-[40px] md:leading-[44px]">
                  {t("faq.title")}
                </h2>
                <div className="mt-10 flex flex-col gap-2">
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

      <ScrollToTopButton label={t("scrollTop")} />
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

/**
 * Колонка страницы: 20 (360/480/768) · 40 (1024) · 1200 внутри бокса 1448 (1920).
 *
 * На 1920 макет держит контент в колонке 1200 (360…1560), а картинки сплит-блоков
 * и карточка FAQ выходят за неё на 124 px наружу — отсюда бокс 1448 с паддингом
 * 124: до 1448 px вьюпорта вынос упирается ровно в край и ничего не срезается.
 */
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
        "relative mx-auto w-full max-w-[1448px] px-5 lg:px-10 xl:px-[124px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Межсекционный отступ: 160 (360/480) · 300 (768) · 400 (1024/1920). */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative pt-40 md:pt-[300px] lg:pt-[400px]">
      {children}
    </section>
  );
}

/** Заголовок секции: 32/38.4 на мобильном, 40/44 с 768. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[32px] font-medium leading-[1.2] text-text-default md:text-[40px] md:leading-[44px]">
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
        "mt-8 text-lg leading-5 text-text-default md:text-2xl md:leading-8",
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
      <h1 className="text-[32px] font-medium leading-[1.2] text-text-default md:text-5xl md:font-bold md:leading-none lg:text-[64px] xl:text-[96px]">
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
    <span className="inline-flex rounded-[50px] bg-[image:var(--gradient-accent)] p-[2px] align-middle shadow-[0_0_28px_rgb(191_90_245/0.3)] xl:p-[3px]">
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
        "relative flex flex-col items-center gap-5 md:flex-row md:gap-10 xl:gap-[164px]",
        reverse ? "md:flex-row-reverse" : "md:flex-row",
      )}
    >
      {/* на 1920 картинка выходит из колонки 1200 наружу на 124 px */}
      <Appear
        className={clsx(
          "shrink-0",
          reverse ? "xl:-mr-[124px]" : "xl:-ml-[124px]",
        )}
      >
        <FloatImage
          src={image}
          tone={tone}
          className="w-[184px] md:w-[279px] lg:w-[354px] xl:w-[456px]"
        />
      </Appear>
      <Appear delay={0.08} className="min-w-0 flex-1 text-center md:text-left">
        <SectionTitle>{titleNode ?? title}</SectionTitle>
        <Lead>{text}</Lead>
        {cta && <CtaButton className="mt-10 md:mt-20">{cta}</CtaButton>}
      </Appear>
    </div>
  );
}

/* --------------------------------------------------------------- элементы */

/**
 * Шапка: ≤768 сплошная #262626 с границей #333333; ≥1024 стекло #FFFFFF 8 %.
 * На 768 макет даёт шапке паддинг 52 при колонке 20 — отсюда md:px-8 сверху
 * контейнерных 20 px.
 */
function LandingHeader({ loginLabel }: { loginLabel: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-stroke-surface1 bg-surface-page-surf1 md:px-8 lg:border-white/12 lg:bg-white/8 lg:px-0 lg:backdrop-blur-2xl">
      <Container className="flex h-[75px] items-center justify-between md:h-[83px]">
        <Link
          href="/"
          aria-label="ecash"
          className="transition-opacity hover:opacity-80"
        >
          <Logo tone="onDark" />
        </Link>
        <Link
          href="/login"
          className="inline-flex h-[42px] items-center gap-2 rounded-2xl bg-btn-1 pl-3 pr-2 text-sm font-medium leading-5 text-text-default transition-colors hover:bg-comp-surface2-hover md:h-[50px] md:pl-6 md:pr-4 lg:bg-white/8 lg:hover:bg-white/15"
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
    <footer className="relative mt-40 border-t border-[#303030] bg-surface-modal-bg md:mt-[300px] lg:mt-[400px]">
      <Container className="py-6 md:py-[60px] xl:pt-[100px]">
        {/* 768 (2153:195970): одна центрированная колонка, gap 60; с 1024 — ряд */}
        <div className="flex flex-col gap-6 md:items-center md:gap-[60px] lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-2 md:items-center md:gap-6 lg:items-start">
            <div className="flex gap-2 md:gap-4">
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
              className="text-base leading-5 text-text-default transition-colors hover:text-text-brand md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]"
            >
              +7 (705) 908 90 73
            </a>
          </div>

          <div className="flex flex-col gap-2 md:items-center md:gap-6 lg:items-start lg:gap-10">
            <div className="text-sm leading-[1.1] text-text-disabled md:text-xl md:leading-8 md:text-text-default">
              {t("schedule")}
            </div>
            <div className="text-base leading-5 text-text-default md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]">
              {t("scheduleValue")}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:items-center md:gap-6 lg:items-start lg:gap-10">
            <div className="text-sm leading-[1.1] text-text-disabled md:text-xl md:leading-8 md:text-text-default">
              {t("additional")}
            </div>
            <span className="inline-flex items-center gap-2.5 text-base leading-5 text-text-default md:text-[28px] md:font-semibold md:leading-8 md:tracking-[-0.45px]">
              {t("documents")}
              <Icon name="arrow_outward" size={20} />
            </span>
          </div>
        </div>

        <div className="mt-12 text-center text-sm leading-[1.1] text-text-disabled md:mt-20 md:text-xl md:leading-8 md:text-text-default lg:text-left">
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
      className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-surface-page-surf1 text-text-default transition-colors hover:bg-comp-surface2-hover md:h-[72px] md:w-[72px] md:rounded-[28px]"
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
          "group flex h-full flex-col gap-5 rounded-[40px] p-6 backdrop-blur-[46px] md:p-9 lg:gap-10 lg:rounded-[64px] lg:p-11",
          accent ? "glass-dense glass-accent" : "glass",
        )}
      >
        {logo ? (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand shadow-[0_0_40px_rgb(241_90_37/0.5)] transition-transform duration-300 group-hover:scale-110 md:h-[72px] md:w-[72px]">
            <img
              src="/img/mark-white.png"
              alt=""
              width={111}
              height={159}
              className="h-8 w-auto md:h-[43px]"
            />
          </span>
        ) : (
          icons && (
            <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[24px] border-2 border-[#616161] transition-colors duration-300 group-hover:border-brand md:h-[100px] md:w-[100px] md:rounded-[32px]">
              <span className="relative h-9 w-9 md:h-[72px] md:w-[72px]">
                <Icon
                  name={icons[0]}
                  filled
                  className="absolute left-0 top-0 text-2xl text-brand drop-shadow-[0_0_12px_rgb(241_90_37/0.6)] transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 md:text-[48px]"
                />
                <Icon
                  name={icons[1]}
                  filled
                  className="absolute bottom-0 right-0 text-2xl text-text-default transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5 md:text-[48px]"
                />
              </span>
            </span>
          )
        )}

        <div className="flex flex-col gap-6">
          <h3
            className={clsx(
              "text-xl font-semibold leading-7 tracking-[-0.45px] md:text-[28px] md:leading-8",
              accent ? "text-text-brand" : "text-text-default",
            )}
          >
            {card.title}
          </h3>
          <p
            className={clsx(
              "text-base leading-5 md:text-xl md:leading-8",
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
 * Карточка этапа: номер 50×50 r16 на #303030 с градиентным кантом (2112:192944).
 * На 1920 ряды идут 704 + 456 и 456 + 704 — это span 2 у элементов 0, 3, 4, …
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
        "glass-veil group h-full rounded-[64px] p-9 backdrop-blur-[46px] lg:p-11",
        wide && "xl:col-span-2",
      )}
    >
      <span className="grad-border inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl bg-[#303030] text-lg font-medium leading-6 text-text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-text-always-white">
        {index + 1}
      </span>
      <h3 className="mt-6 text-xl font-semibold leading-7 tracking-[-0.45px] text-text-default md:text-[28px] md:leading-8 lg:mt-11">
        {step.title}
      </h3>
      <p className="mt-6 text-base leading-5 text-text-default md:text-xl md:leading-8">
        {step.text}
      </p>
    </motion.article>
  );
}

/** Кнопка макета: 254×66 r40 p16/24 gap16 на мобильном → 254×80 r102 p24/40 gap24 с 768. */
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
        className="group relative inline-flex h-[66px] cursor-pointer items-center gap-4 overflow-hidden rounded-[40px] bg-brand px-6 text-base leading-8 text-text-default shadow-[0_12px_40px_rgb(241_90_37/0.45)] transition-[box-shadow,filter] hover:shadow-[0_20px_64px_rgb(241_90_37/0.65)] hover:brightness-110 md:h-20 md:gap-6 md:rounded-[102px] md:px-10 md:text-2xl"
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
 * Карточка p36 gap24 r64 (768) → p64 gap44 r64 (1024+); ширина 429 на 768,
 * 704 (пакет) / 580 (поддержка) с 1024. Ряды сдвинуты в разные стороны при
 * скролле — так они «живут», как в прототипе.
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
        <div
          key={railIndex}
          className="flex flex-col gap-5 md:-mx-5 md:snap-x md:snap-mandatory md:flex-row md:gap-5 md:overflow-x-auto md:px-5 md:pb-2 md:[scrollbar-width:none] lg:-mx-10 lg:gap-10 lg:px-10 xl:mx-0 xl:px-0 md:[&::-webkit-scrollbar]:hidden"
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
   * Пакет (2153:195538…195557): 0 — плотная #262626 60 % с градиентным кантом,
   * 1 — стекло с белым кантом, 2 — стекло с градиентным кантом.
   * Поддержка (2153:195461…195496): чётные — стекло, нечётные — плотная
   * заливка с градиентным кантом.
   */
  const dense = support ? index % 2 === 1 : index % 3 === 0;
  const gradient = support ? index % 2 === 1 : index % 3 !== 1;

  return (
    <motion.div
      initial={reduced ? undefined : { opacity: 0, y: 20 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index, 3) * 0.07 }}
      whileHover={reduced ? undefined : { y: -6 }}
      className={clsx(
        "md:w-[429px] md:shrink-0 md:snap-start",
        support ? "lg:w-[580px]" : "lg:w-[704px]",
      )}
    >
      <Spotlight
        tone={gradient ? "#BF5AF5" : "#F6844B"}
        className={clsx(
          "flex h-full flex-col gap-6 rounded-[64px] p-9 backdrop-blur-[46px] lg:gap-11 lg:p-16",
          dense ? "glass-dense" : "glass-veil",
          gradient && "glass-accent",
        )}
      >
        <h3 className="text-xl font-semibold leading-7 tracking-[-0.45px] text-text-default md:text-[28px] md:leading-8">
          {item.title}
        </h3>
        <p className="text-base leading-5 text-text-default md:text-xl md:leading-8">
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
        "rounded-[36px] bg-[#303030] p-5 transition-colors duration-300 md:rounded-[64px] md:p-11",
        open ? "bg-[#3b3b3b]" : "hover:bg-[#363636]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 text-left"
      >
        <span className="min-w-0 flex-1 text-base font-semibold leading-5 tracking-[-0.45px] text-text-default md:text-[28px] md:leading-8">
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
            <div className="mt-6 border-t border-[#454545] pt-6 text-base leading-5 text-text-default md:text-xl md:leading-8">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
