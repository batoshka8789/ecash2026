'use client';

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import type { RefObject } from 'react';

/**
 * Цветные свечения лендинга — эллипсы «bg blur» из макета.
 *
 * Ключевой момент: в Figma эллипс маленький, но размытие огромное, и цвет
 * расходится далеко за его границы. Видимое пятно ≈ размер + 2 × радиус:
 *
 *   #5500FF  960 + 2×1080 ≈ 3120  центр (1920, 2026)  → правый край, 18 % высоты
 *   #FF0051  736 + 2×988  ≈ 2712  центр (0,    4021)  → левый край,  36 %
 *   #9D00FF  790 + 2×1060 ≈ 2910  центр (1920, 7292)  → правый край, 65 %
 *   #FF4200 1271 + 2×1679 ≈ 4629  центр (0,    8733)  → левый край,  78 %
 *
 * Поэтому пятна позиционируются по центру у кромок страницы и занимают
 * 145–245 vw на десктопе (на мобильных — до 440 vw, как во фреймах 360/480).
 * Слои идут в режиме screen: на тёмном фоне цвета складываются со светом.
 */
const GLOWS = [
  {
    color: '#5500FF',
    core: '#7B3BFF',
    edge: 'right' as const,
    top: '18%',
    size: 'w-[400vw] md:w-[380vw] lg:w-[300vw] xl:w-[165vw]',
    drift: [0, -110],
    strength: 0.72,
  },
  {
    color: '#FF0051',
    core: '#FF3D74',
    edge: 'left' as const,
    top: '36%',
    size: 'w-[360vw] md:w-[350vw] lg:w-[240vw] xl:w-[145vw]',
    drift: [0, 130],
    strength: 0.78,
  },
  {
    color: '#9D00FF',
    core: '#B845FF',
    edge: 'right' as const,
    top: '65%',
    size: 'w-[380vw] md:w-[350vw] lg:w-[260vw] xl:w-[155vw]',
    drift: [0, -120],
    strength: 0.7,
  },
  {
    color: '#FF4200',
    core: '#FF7A3D',
    edge: 'left' as const,
    top: '78%',
    size: 'w-[440vw] md:w-[400vw] lg:w-[340vw] xl:w-[245vw]',
    drift: [0, 140],
    strength: 0.72,
  },
];

export function Glows({ container }: { container: RefObject<HTMLDivElement | null> }) {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: container, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 60, damping: 25, restDelta: 0.001 });

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ isolation: 'isolate' }}
    >
      {GLOWS.map((g, i) => (
        <Glow key={g.color} glow={g} progress={progress} reduced={Boolean(reduced)} index={i} />
      ))}
    </div>
  );
}

function Glow({
  glow,
  progress,
  reduced,
  index,
}: {
  glow: (typeof GLOWS)[number];
  progress: MotionValue<number>;
  reduced: boolean;
  index: number;
}) {
  // параллакс: свечение отстаёт от контента при скролле
  const y = useTransform(progress, [0, 1], glow.drift);
  const s = glow.strength;

  return (
    <motion.span
      className={`absolute aspect-square max-w-[3400px] -translate-x-1/2 -translate-y-1/2 rounded-full ${glow.size} ${
        glow.edge === 'right' ? 'left-full' : 'left-0'
      }`}
      style={{ top: glow.top, y: reduced ? 0 : y, willChange: 'transform' }}
    >
      {/* широкий ореол */}
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${glow.color} 0%, ${glow.color}d9 26%, ${glow.color}80 48%, ${glow.color}33 66%, transparent 80%)`,
          opacity: 0.42 * s,
          mixBlendMode: 'screen',
        }}
        animate={reduced ? undefined : { scale: [1, 1.08, 1], opacity: [0.42 * s, 0.56 * s, 0.42 * s] }}
        transition={{ duration: 15 + index * 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* плотное ядро */}
      <motion.span
        className="absolute inset-[26%] rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${glow.core} 0%, ${glow.core}aa 42%, transparent 74%)`,
          opacity: 0.5 * s,
          mixBlendMode: 'screen',
        }}
        animate={reduced ? undefined : { scale: [1, 1.13, 1], opacity: [0.5 * s, 0.68 * s, 0.5 * s] }}
        transition={{ duration: 11 + index * 2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
      />
      {/* яркая искра */}
      <motion.span
        className="absolute inset-[42%] rounded-full"
        style={{
          background: `radial-gradient(closest-side, #ffffff 0%, ${glow.core}bb 38%, transparent 72%)`,
          opacity: 0.2 * s,
          mixBlendMode: 'screen',
        }}
        animate={reduced ? undefined : { scale: [1, 1.22, 1], opacity: [0.2 * s, 0.32 * s, 0.2 * s] }}
        transition={{ duration: 8 + index, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
      />
    </motion.span>
  );
}
