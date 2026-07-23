'use client';

import { clsx } from 'clsx';
import { useState, type InputHTMLAttributes } from 'react';
import { Icon } from './Icon';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Список ошибок под полем (красные строки 12px, как в макете). */
  errors?: string[];
  /** Поле пароля с глазком. */
  password?: boolean;
};

/** Текстовое поле ecash: прозрачный фон, бордер stroke-modal, r-16. */
export function Input({ errors, password, className, ...rest }: InputProps) {
  const [show, setShow] = useState(false);
  const invalid = Boolean(errors?.length);

  return (
    <div className={className}>
      <div
        className={clsx(
          'flex items-center rounded-2xl border bg-transparent transition-colors focus-within:border-stroke-surface3',
          invalid ? 'border-negative' : 'border-stroke-modal',
        )}
      >
        <input
          {...rest}
          type={password && !show ? 'password' : (rest.type ?? 'text')}
          className="h-12 w-full bg-transparent px-4 text-base text-text-default outline-none placeholder:text-text-disabled"
        />
        {password && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
            className="cursor-pointer px-3 text-text-disabled transition-colors hover:text-text-default"
          >
            <Icon name={show ? 'visibility' : 'visibility_off'} size={20} />
          </button>
        )}
      </div>
      {errors?.map((e) => (
        <p key={e} className="mt-1 pl-1 text-xs text-text-negative">
          {e}
        </p>
      ))}
    </div>
  );
}
