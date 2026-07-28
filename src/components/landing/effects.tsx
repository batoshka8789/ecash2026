'use client';

/* eslint-disable @next/next/no-img-element */

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
} from 'framer-motion';
import { clsx } from 'clsx';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from 'react';

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

    if (document.visibilityState === 'visible') {
      arm();
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') arm();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return ready;
}

/* --------------------------------------------------- reduced-motion */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const readReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

/**
 * prefers-reduced-motion, безопасный для гидратации.
 *
 * useReducedMotion из framer-motion читает медиазапрос синхронно уже в первом
 * рендере: на сервере получается false, на клиенте — настоящее значение, и там,
 * где от него зависит разметка, Next валится с «Hydration failed».
 * useSyncExternalStore отдаёт false и на сервере, и в первом клиентском рендере
 * (getServerSnapshot), а настоящее значение подставляет уже после гидратации —
 * сами анимации при этом не меняются.
 */
export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
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
  tone = '#F6844B',
  as: Tag = 'article',
}: {
  children: ReactNode;
  className?: string;
  /** цвет пятна — оранжевый для обычных карточек, сиреневый для акцентных */
  tone?: string;
  as?: 'article' | 'div';
}) {
  const reduced = useReducedMotionSafe();
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

  const MotionTag = Tag === 'div' ? motion.div : motion.article;

  return (
    <MotionTag
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={clsx('group/spot relative isolate overflow-hidden', className)}
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
  const reduced = useReducedMotionSafe();
  const ref = useRef<HTMLDivElement>(null);

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  const spring = { stiffness: 180, damping: 18 };
  const rotateX = useSpring(useTransform(py, [0, 1], [strength, -strength]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-strength, strength]), spring);

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
      className={clsx('[perspective:1200px]', className)}
    >
      <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}>
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
  const reduced = useReducedMotionSafe();
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
      className={clsx('inline-block', className)}
    >
      <motion.div style={{ x, y }}>{children}</motion.div>
    </div>
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
}: {
  src: string;
  /** цвет ореола — под цвет свечения секции */
  tone: string;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotionSafe();
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
    offset: ['start end', 'end start'],
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

  // ref нужен и здесь: useScroll выше уже подписался на него, и без
  // привязки к узлу motion валится с «Target ref is defined but not hydrated».
  if (reduced) {
    return (
      <div ref={ref} className={clsx('relative', className)}>
        <img src={src} alt="" className="relative w-full" />
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ y: parallax, scale }}
      className={clsx('relative [perspective:1200px]', className)}
    >
      {/* пульсирующий ореол под картинкой */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[135%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${tone}88 0%, ${tone}44 45%, transparent 72%)`,
          mixBlendMode: 'screen',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay }}
      />

      {/* парение + наклон */}
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <img
          src={src}
          alt=""
          className="relative w-full"
          style={{ filter: `drop-shadow(0 26px 60px ${tone}66)` }}
        />
      </motion.div>
    </motion.div>
  );
}
