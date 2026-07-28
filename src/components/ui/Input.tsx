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
        <label
          htmlFor={inputId}
          className="mb-1 block text-xs font-bold leading-[1.2] text-text-disabled"
        >
          {label}
        </label>
      )}
      <div
        className={clsx(
          // 54×r20 c бордером 1px — «Input» из дизайн-системы (883:33235)
          'flex items-center rounded-[20px] border bg-transparent transition-colors',
          // hover: подложка surface/surf2 + обводка #616161 (885:33285)
          'hover:bg-surface-page-surf2',
          // focus перебивает и hover, и ошибку — в макете обводка surface/inverted
          'focus-within:border-surface-inverted focus-within:hover:border-surface-inverted',
          invalid
            ? 'border-negative hover:border-negative'
            : 'border-surface-page-surf3 hover:border-stroke-input-hover',
        )}
      >
        <input
          {...rest}
          id={inputId}
          aria-label={!label ? rest.placeholder : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errId : undefined}
          type={password && !show ? 'password' : (rest.type ?? 'text')}
          // 52 + 2px бордера = 54. Значение — Roboto SemiBold 16/20
          // (885:34028), плейсхолдер — Inter Semi Bold 16/21 (883:33233)
          className="h-[52px] w-full bg-transparent px-4 text-base font-semibold leading-5 text-text-default outline-none placeholder:font-inter placeholder:font-semibold placeholder:leading-[21px] placeholder:text-text-disabled"
        />
        {password && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? t('hidePassword') : t('showPassword')}
            aria-pressed={show}
            className="cursor-pointer py-3 pl-2 pr-4 text-text-disabled transition-colors hover:text-text-default"
          >
            <Icon name={show ? 'visibility' : 'visibility_off'} size={20} />
          </button>
        )}
      </div>
      {invalid && (
        <div id={errId} role="alert">
          {errors!.map((e) => (
            <p key={e} className="mt-1 text-xs font-medium leading-[1.3] text-text-negative">
              {e}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
