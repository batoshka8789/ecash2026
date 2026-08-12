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
  type CSSProperties,
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
 * Плёночное зерно поверх всей страницы — даёт глубину, за счёт чего цветные
 * свечения читаются контрастнее. Виньетки (радиального затемнения к краям)
 * здесь нет: серый градиент лежал поверх всех блоков и глушил их.
 */
export function GrainOverlay() {
  return (
    <span
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 opacity-[0.055] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E\")",
      }}
    />
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
  width,
  height,
}: {
  src: string;
  /** цвет ореола — под цвет свечения секции */
  tone: string;
  className?: string;
  delay?: number;
  /** первый экран: грузить сразу и с высоким приоритетом, не лениво */
  priority?: boolean;
  /** пиксели файла: браузер резервирует место до загрузки, блок не прыгает */
  width: number;
  height: number;
}) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  /**
   * «Уменьшить движение» учитываем ТОЛЬКО после монтирования — для этого
   * годится тот же useAnimReady, что гейтит входные анимации.
   *
   * `useReducedMotion` на сервере всегда false, а в браузере с включённой
   * настройкой отдаёт true уже на первом рендере — и React падал с ошибкой
   * гидратации: сервер прислал одну разметку, клиент нарисовал другую.
   * Ловилось не у всех, поэтому и жило долго: настройка включена не у
   * каждого (на iPhone — часто, и сама включается в энергосбережении).
   *
   * Теперь первый рендер одинаков всегда, а дальше компонент спокойно
   * перерисуется — это обычное обновление, не гидратация.
   */
  const reduced = useAnimReady() && !!prefersReduced;

  /**
   * Тень и показ — только после декодирования. drop-shadow до декодирования
   * рисуется по прямоугольнику элемента, а не по контуру картинки: пока файл
   * грузился, вокруг «монеты» на пару секунд появлялась прямоугольная рамка
   * тени. У eager-картинок onLoad может отстрелять до гидратации — проверка
   * complete в эффекте закрывает и этот случай.
   */
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

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

  const img = (
    <img
      ref={imgRef}
      src={src}
      alt=""
      width={width}
      height={height}
      onLoad={() => setLoaded(true)}
      className={clsx(
        "relative h-auto w-full transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
      )}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      // translateZ закрепляет растровый слой: без него повышение/сброс слоя
      // на старте анимаций мигали его границами на части GPU
      style={
        loaded
          ? { filter: `drop-shadow(0 26px 60px ${tone}66)`, transform: "translateZ(0)" }
          : undefined
      }
    />
  );

  /*
   * Дерево ОДНО на оба режима — разница только в значениях. Раньше здесь
   * стояли два разных `return`, и на устройстве с «уменьшить движение»
   * разметка сервера не совпадала с клиентской.
   *
   * «Уменьшение движения» гасит ДВИЖЕНИЕ, но не цвет: ореол и подсветка —
   * часть фирменной палитры макета, а не анимация. Сами циклы (пульсация
   * ореола, парение) живут в CSS и глушатся медиазапросом
   * prefers-reduced-motion — здесь их гасить не нужно.
   *
   * На JS остаются параллакс от прокрутки и наклон за курсором: первый
   * отключаем значением style, второй — проверкой в onMove.
   */
  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={reduced ? undefined : { y: parallax, scale }}
      className={clsx("relative [perspective:1200px]", className)}
    >
      <span
        aria-hidden
        className="anim-halo-pulse pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[135%] rounded-full"
        style={
          {
            background: `radial-gradient(closest-side, ${tone}88 0%, ${tone}44 45%, transparent 72%)`,
            mixBlendMode: "screen",
            "--anim-delay": `${delay}s`,
          } as CSSProperties
        }
      />

      <div className="anim-float-y" style={{ "--anim-delay": `${delay}s` } as CSSProperties}>
        <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>{img}</motion.div>
      </div>
    </motion.div>
  );
}
