'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';
import { DEFAULT_IMAGE_FOCUS, IMAGE_FOCUS, type ImageFocus } from '@/lib/domain';

const MAX_BYTES = 8 * 1024 * 1024;

/** Подписи узлов сетки — в том же порядке, что IMAGE_FOCUS. */
const FOCUS_LABEL: Record<ImageFocus, string> = {
  '0% 0%': 'сверху слева',
  '50% 0%': 'сверху по центру',
  '100% 0%': 'сверху справа',
  '0% 50%': 'слева',
  '50% 50%': 'по центру',
  '100% 50%': 'справа',
  '0% 100%': 'снизу слева',
  '50% 100%': 'снизу по центру',
  '100% 100%': 'снизу справа',
};

/**
 * Обложка новости: перетаскивание или выбор файла.
 *
 * Предпросмотр показывается СРАЗУ, ещё до окончания загрузки — из локального
 * blob-адреса. Такой адрес нужно освобождать вручную, иначе течёт память,
 * поэтому отзыв стоит в трёх местах: при замене файла, после того как
 * подгрузился серверный вариант, и при уходе со страницы.
 *
 * Картинку в ленте обрезает object-cover, и какая часть уцелеет — зависит от
 * пропорций экрана. Поэтому здесь же выбирается точка кадрирования, а кнопка
 * «вся картинка» показывает, что именно уходит за край.
 */
export function ImageDrop({
  value,
  onChange,
  onLocalPreview,
  focus = DEFAULT_IMAGE_FOCUS,
  onFocusChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  /** blob-адрес для живого превью, пока файл ещё летит на сервер */
  onLocalPreview?: (url: string | null) => void;
  focus?: ImageFocus;
  onFocusChange?: (focus: ImageFocus) => void;
}) {
  const inputId = useId();
  const errorText = useErrorText();
  const objectUrl = useRef<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [whole, setWhole] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const releaseObjectUrl = () => {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  };

  useEffect(() => releaseObjectUrl, []);

  const setPreview = (url: string | null) => {
    setLocal(url);
    onLocalPreview?.(url);
  };

  const pick = async (file: File | null) => {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) return setError(errorText('errors.fileType'));
    if (file.size > MAX_BYTES) return setError(errorText('errors.fileTooLarge'));

    releaseObjectUrl();
    objectUrl.current = URL.createObjectURL(file);
    setPreview(objectUrl.current);
    setBusy(true);

    try {
      const { media } = await api.admin.uploadImage(file);
      // ждём, пока серверная картинка окажется в кеше браузера, и только
      // потом снимаем локальную — иначе превью мигнёт пустотой
      await new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = media.url;
      });
      onChange(media.url);
      setPreview(null);
      releaseObjectUrl();
    } catch (e) {
      setError(e instanceof ApiError ? errorText(e.message) : errorText('errors.unknown'));
      setPreview(null);
      releaseObjectUrl();
    } finally {
      setBusy(false);
    }
  };

  const shown = local ?? value;

  return (
    <div className="flex flex-col gap-3">
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="peer sr-only"
        onChange={(e) => {
          void pick(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />

      {shown ? (
        <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-surface-page-surf3 sm:h-72">
          {/* и blob, и /api/media — обычный img: оптимизатор blob-адреса не берёт */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown}
            alt=""
            onLoad={(e) =>
              setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
            style={{ objectPosition: focus }}
            // без transition: плавный переезд object-position здесь застревал —
            // инлайн-стиль уже новый, а вычисленное значение оставалось старым,
            // и кадр visually не совпадал с выбранным. Ровно тот же класс
            // проблем, что уже ловили с mount-анимациями в этом проекте.
            className={clsx('h-full w-full', whole ? 'object-contain' : 'object-cover')}
          />

          {/* показать всю картинку — так видно, что именно уходит за край */}
          <button
            type="button"
            onClick={() => setWhole((v) => !v)}
            aria-pressed={whole}
            className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-page-bg/85 px-3 py-1.5 text-xs font-medium text-text-default backdrop-blur transition-colors hover:bg-surface-page-bg"
          >
            <Icon name={whole ? 'crop' : 'fit_screen'} size={16} />
            {whole ? 'Показать кадр' : 'Вся картинка'}
          </button>

          {/* выбор видимой части: сетка 3×3 поверх картинки */}
          {onFocusChange && (
            <div
              role="radiogroup"
              aria-label="Что оставить в кадре"
              className="absolute bottom-3 left-3 grid grid-cols-3 gap-0.5 rounded-xl bg-surface-page-bg/85 p-1 backdrop-blur"
            >
              {IMAGE_FOCUS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={focus === f}
                  aria-label={`Кадрировать ${FOCUS_LABEL[f]}`}
                  title={FOCUS_LABEL[f]}
                  onClick={() => onFocusChange(f)}
                  className={clsx(
                    'h-5 w-5 cursor-pointer rounded transition-colors',
                    focus === f ? 'bg-brand' : 'bg-surface-page-surf3 hover:bg-comp-surface2-hover',
                  )}
                />
              ))}
            </div>
          )}

          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-scrim">
              <span className="flex items-center gap-2 rounded-full bg-surface-page-surf1 px-4 py-2 text-sm text-text-default">
                <Icon name="progress_activity" size={18} className="animate-spin" />
                Загружаю…
              </span>
            </div>
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void pick(e.dataTransfer.files?.[0] ?? null);
          }}
          className={clsx(
            'flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:h-72',
            'peer-focus-visible:border-stroke-brand peer-focus-visible:bg-brand-hardsoft',
            dragOver
              ? 'border-stroke-brand bg-brand-hardsoft'
              : error
                ? 'border-negative'
                : 'border-stroke-surface3 hover:border-stroke-brand',
          )}
        >
          <Icon name="add_photo_alternate" size={32} className="text-text-disabled" />
          <span className="text-sm text-text-default">
            Перетащите картинку или нажмите, чтобы выбрать
          </span>
          <span className="text-xs text-text-disabled">
            JPG, PNG, WebP · до 8 МБ · лучше 1440×720
          </span>
        </label>
      )}

      {shown && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="surf2"
            size="md"
            onClick={() => document.getElementById(inputId)?.click()}
            disabled={busy}
          >
            Заменить
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="text-text-negative"
            disabled={busy}
            onClick={() => {
              releaseObjectUrl();
              setPreview(null);
              setSize(null);
              onChange(null);
            }}
          >
            Удалить
          </Button>
          <span className="ml-auto text-xs text-text-disabled">
            {size ? `${size.w}×${size.h} · ` : ''}
            кадр: {FOCUS_LABEL[focus]}
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
