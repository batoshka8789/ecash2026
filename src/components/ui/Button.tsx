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

const sizes: Record<Size, string> = {
  md: 'h-10 px-5 text-sm rounded-full',
  lg: 'h-12 px-6 text-base rounded-full',
  icon: 'h-10 w-10 rounded-xl',
  'icon-lg': 'h-12 w-12 rounded-2xl',
};

/** Кнопка ecash: пилюли для текста, скруглённые квадраты для иконок. */
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
