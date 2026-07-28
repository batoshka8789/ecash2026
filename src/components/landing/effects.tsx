"use client";

/* eslint-disable @next/next/no-img-element */

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useScroll,
} from "framer-motion";
import { clsx } from "clsx";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";

/**
 * Интерактивные эффекты лендинга.
 * Все уважают prefers-reduced-motion и не меняют вёрстку макета —
 * они добавляют глубину поверх точных размеров и цветов Figma.
 */

/* ------------------------------------------------- готовность анимаций */

/**
 * true — только после первого тика requestAnimationFrame в видимой вкладке.
 *
 * Скрывающие контент entrance-анимации можно включать лишь тогда, когда
 * они гарантированно отыграют. В prerender-вкладке, фоновой вкладке или
 * при замороженном rAF хук остаётся false — и компоненты рендерят контент
 * видимым, без анимации. Иначе страница может навсегда остаться пустой.
 */
export function useAnimReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let raf = 0;

    const arm = () => {
      raf = requestAnimationFrame(() => setReady(true));
    };

    if (document.visibilityState === "visible") {
      arm();
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") arm();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return ready;
}

/* ------------------------------------------------------------- спотлайт */

/**
 * Карточка со «световым пятном» за курсором и бликом по верхней грани.
 * Пятно — радиальный градиент в координатах указателя; блик — тонкая
 * светлая линия сверху, как на матовом стекле.
 */
export function Spotlight({
  children,
  className,
  tone = "#F6844B",
  as: Tag = "article",
}: {
  children: ReactNode;
  className?: string;
  /** цвет пятна — оранжевый для обычных карточек, сиреневый для акцентных */
  tone?: string;
  as?: "article" | "div";
}) {
  const reduced = useReducedMotion();
  const mx = useMotionValue(-9999);
  const my = useMotionValue(-9999);

  const background = useMotionTemplate`radial-gradient(340px circle at ${mx}px ${my}px, ${tone}22, transparent 70%)`;

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const onLeave = () => {
    mx.set(-9999);
    my.set(-9999);
  };

  const MotionTag = Tag === "div" ? motion.div : motion.article;

  return (
    <MotionTag
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={clsx("group/spot relative isolate overflow-hidden", className)}
    >
      {/* световое пятно за курсором */}
      <motion.span
        aria-hidden
        style={{ background }}
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
      />
      {/* блик по верхней грани */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      {children}
    </MotionTag>
  );
}

/* ----------------------------------------------------------------- тилт */

/** Лёгкий 3D-наклон за курсором — для крупных изображений секций. */
export function Tilt({
  children,
  className,
  strength = 10,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  const spring = { stiffness: 180, damping: 18 };
  const rotateX = useSpring(
    useTransform(py, [0, 1], [strength, -strength]),
    spring,
  );
  const rotateY = useSpring(
    useTransform(px, [0, 1], [-strength, strength]),
    spring,
  );

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };

  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={clsx("[perspective:1200px]", className)}
    >
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
        {children}
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------- магнит */

/** Кнопка притягивается к курсору — «магнитный» эффект AAA-лендингов. */
export function Magnetic({
  children,
  className,
  radius = 26,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const spring = { stiffness: 260, damping: 20, mass: 0.4 };
  const x = useSpring(useMotionValue(0), spring);
  const y = useSpring(useMotionValue(0), spring);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    x.set(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * radius);
    y.set(((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * radius);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={clsx("inline-block", className)}
    >
      <motion.div style={{ x, y }}>{children}</motion.div>
    </div>
  );
}

/* -------------------------------------------------------------- зерно */

/**
 * Плёночное зерно и виньетка поверх всей страницы — дают глубину
 * и «прижимают» края, за счёт чего цветные свечения читаются контрастнее.
 */
export function GrainOverlay() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none fixed inset-0 z-30 opacity-[0.055] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E\")",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none fixed inset-0 z-20"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 45%, rgb(0 0 0 / 0.45) 100%)",
        }}
      />
    </>
  );
}

/* ------------------------------------------------------- живые картинки */

/**
 * 3D-рендер секции: непрерывное парение, наклон за курсором, параллакс при
 * скролле и пульсирующий цветной ореол за изображением.
 *
 * Ореол берёт цвет ближайшего свечения секции — так картинка выглядит
 * подсвеченной источником, а не наклеенной поверх фона.
 */
export function FloatImage({
  src,
  tone,
  className,
  delay = 0,
  priority = false,
}: {
  src: string;
  /** цвет ореола — под цвет свечения секции */
  tone: string;
  className?: string;
  delay?: number;
  /** первый экран: грузить сразу и с высоким приоритетом, не лениво */
  priority?: boolean;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // наклон за курсором
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 150, damping: 16 };
  const rotateX = useSpring(useTransform(py, [0, 1], [14, -14]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-14, 14]), spring);

  // параллакс при скролле
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const parallax = useSpring(useTransform(scrollYProgress, [0, 1], [40, -40]), {
    stiffness: 70,
    damping: 22,
  });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.92, 1, 0.96]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };

  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };

  if (reduced) {
    // «Уменьшение движения» гасит ДВИЖЕНИЕ, но не цвет: ореол и подсветка —
    // часть фирменной палитры макета, а не анимация. Раньше эта ветка отдавала
    // голый <img>, и на любом устройстве с включённой настройкой (на iPhone она
    // часто включена, а в режиме энергосбережения включается сама) лендинг
    // становился плоским и терял контраст. Рисуем то же свечение статикой.
    return (
      <div className={clsx("relative", className)}>
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[135%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(closest-side, ${tone}88 0%, ${tone}44 45%, transparent 72%)`,
            mixBlendMode: "screen",
            opacity: 0.7,
          }}
        />
        <img
          src={src}
          alt=""
          className="relative w-full"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          style={{ filter: `drop-shadow(0 26px 60px ${tone}66)` }}
        />
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ y: parallax, scale }}
      className={clsx("relative [perspective:1200px]", className)}
    >
      {/* пульсирующий ореол под картинкой */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[135%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${tone}88 0%, ${tone}44 45%, transparent 72%)`,
          mixBlendMode: "screen",
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay }}
      />

      {/* парение + наклон */}
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay }}
      >
        <img
          src={src}
          alt=""
          className="relative w-full"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          style={{ filter: `drop-shadow(0 26px 60px ${tone}66)` }}
        />
      </motion.div>
    </motion.div>
  );
}
