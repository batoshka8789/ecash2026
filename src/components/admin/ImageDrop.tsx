'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Обложка новости: перетаскивание или выбор файла.
 *
 * Предпросмотр показывается СРАЗУ, ещё до окончания загрузки — из локального
 * blob-адреса. Такой адрес нужно освобождать вручную, иначе течёт память,
 * поэтому отзыв стоит в трёх местах: при замене файла, после того как
 * подгрузился серверный вариант, и при уходе со страницы.
 */
export function ImageDrop({
  value,
  onChange,
  onLocalPreview,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  /** blob-адрес для живого превью, пока файл ещё летит на сервер */
  onLocalPreview?: (url: string | null) => void;
}) {
  const inputId = useId();
  const errorText = useErrorText();
  const objectUrl = useRef<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
        <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-surface-page-surf2 sm:h-72">
          {/* и blob, и /api/media — обычный img: оптимизатор blob-адреса не берёт */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="" className="h-full w-full object-cover" />
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
        <div className="flex gap-2">
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
              onChange(null);
            }}
          >
            Удалить
          </Button>
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
