'use client';

import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'brand' | 'brand-outline' | 'surf1' | 'surf2' | 'ghost';
type Size = 'md' | 'lg' | 'icon' | 'icon-lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variants: Record<Variant, string> = {
  brand:
    'bg-btn-brand text-text-always-white hover:brightness-110 active:brightness-95 disabled:bg-comp-btn2-disabled disabled:text-text-disabled',
  'brand-outline':
    'border border-stroke-brand text-text-brand hover:bg-brand-hardsoft active:bg-brand-hardsoft',
  surf1:
    'bg-btn-1 text-text-default hover:bg-comp-surface2-hover active:bg-comp-surface2-active disabled:bg-comp-btn2-disabled disabled:text-text-disabled',
  surf2:
    'bg-btn-2 text-text-default hover:bg-comp-surface2-hover active:bg-comp-surface2-active disabled:bg-comp-btn3-disabled disabled:text-text-disabled',
  ghost: 'text-text-default hover:bg-comp-surface1-hover active:bg-comp-surface2-active',
};

/**
 * Размеры из компонента макета «a-button-main» (846:26437):
 * L — 54px, padding 16/24; M — 46px, padding 12/24; радиус 20 у обоих,
 * текст Roboto Medium 14/20px независимо от размера. Кнопки-иконки —
 * из «a-button-shapeIcon» (305:12749): 40px при радиусе 16.
 */
const sizes: Record<Size, string> = {
  md: 'h-[46px] px-6 text-sm leading-5 rounded-[20px]',
  lg: 'h-[54px] px-6 text-sm leading-5 rounded-[20px]',
  icon: 'h-10 w-10 rounded-2xl',
  'icon-lg': 'h-[54px] w-[54px] rounded-[20px]',
};

/** Кнопка ecash: скруглённый прямоугольник r20, иконки 20×20 с зазором 8. */
export function Button({
  variant = 'brand',
  size = 'lg',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex cursor-pointer items-center justify-center gap-2 font-medium transition-[background,filter] duration-150 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
