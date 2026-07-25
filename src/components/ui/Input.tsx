'use client';

import { clsx } from 'clsx';
import { useId, useState, type InputHTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './Icon';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Список ошибок под полем (красные строки 12px, как в макете). */
  errors?: string[];
  /** Поле пароля с глазком. */
  password?: boolean;
  /** Видимая подпись поля. Без неё placeholder дублируется в aria-label. */
  label?: string;
};

/** Текстовое поле ecash: прозрачный фон, бордер stroke-modal, r-16. */
export function Input({ errors, password, label, className, id, ...rest }: InputProps) {
  const t = useTranslations('common');
  const [show, setShow] = useState(false);
  const autoId = useId();
  const inputId = id ?? autoId;
  const errId = `${inputId}-err`;
  const invalid = Boolean(errors?.length);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block pl-1 text-sm text-text-disabled">
          {label}
        </label>
      )}
      <div
        className={clsx(
          'flex items-center rounded-2xl border bg-transparent transition-colors focus-within:border-stroke-surface3',
          invalid ? 'border-negative' : 'border-stroke-modal',
        )}
      >
        <input
          {...rest}
          id={inputId}
          aria-label={!label ? rest.placeholder : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errId : undefined}
          type={password && !show ? 'password' : (rest.type ?? 'text')}
          className="h-12 w-full bg-transparent px-4 text-base text-text-default outline-none placeholder:text-text-disabled"
        />
        {password && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? t('hidePassword') : t('showPassword')}
            aria-pressed={show}
            className="cursor-pointer px-3 text-text-disabled transition-colors hover:text-text-default"
          >
            <Icon name={show ? 'visibility' : 'visibility_off'} size={20} />
          </button>
        )}
      </div>
      {invalid && (
        <div id={errId} role="alert">
          {errors!.map((e) => (
            <p key={e} className="mt-1 pl-1 text-xs text-text-negative">
              {e}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
