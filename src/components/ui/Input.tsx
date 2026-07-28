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

/** Текстовое поле ecash: прозрачный фон, r20, бордер surface/surf3. */
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
          // 54×r20 c бордером 1px — «Input» из дизайн-системы ecash-beta.
          // Глобальное кольцо фокуса на инпутах отключено в globals.css,
          // рисунок фокуса здесь свой.
          'flex items-center rounded-[20px] border bg-transparent transition-colors',
          // hover: подложка surface/surf2 + обводка #616161
          'hover:bg-surface-page-surf2',
          // focus перебивает и hover, и ошибку — обводка surface/inverted
          'focus-within:border-surface-inverted focus-within:hover:border-surface-inverted',
          // при ошибке красная рамка держится и в фокусе — иначе автофокус
          // первого невалидного поля прятал бы её ровно в момент показа
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
          // 52 + 2px бордера = 54. Значение и плейсхолдер — 16/20 SemiBold
          // (в макете плейсхолдер набран Inter, в Ecash Inter не подключён —
          // остаётся базовый Roboto того же начертания)
          className="h-[52px] w-full bg-transparent px-4 text-base font-semibold leading-5 text-text-default outline-none placeholder:font-semibold placeholder:leading-[21px] placeholder:text-text-disabled"
        />
        {password && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? t('hidePassword') : t('showPassword')}
            aria-pressed={show}
            /*
             * flex обязателен: у ligature-иконки Material Symbols своя базовая
             * линия, и в обычной строке под глиф добавляется место под выносные
             * элементы — глазок вставал выше центра поля на пару пикселей.
             * Во flex-контейнере базовая линия не участвует, глиф центрируется
             * по коробке кнопки, а она — по коробке поля (items-center).
             */
            className="flex cursor-pointer items-center justify-center py-3 pl-2 pr-4 text-text-disabled transition-colors hover:text-text-default"
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
