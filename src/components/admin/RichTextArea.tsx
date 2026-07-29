'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { applyCommand, continueList, type EditCommand } from '@/lib/editor-commands';

const TOOLS: { cmd: EditCommand; icon: string; title: string; keys?: string }[] = [
  { cmd: 'bold', icon: 'format_bold', title: 'Жирный', keys: 'Meta+B' },
  { cmd: 'italic', icon: 'format_italic', title: 'Курсив', keys: 'Meta+I' },
  { cmd: 'h2', icon: 'format_h2', title: 'Заголовок' },
  { cmd: 'h3', icon: 'format_h3', title: 'Подзаголовок' },
  { cmd: 'bullet', icon: 'format_list_bulleted', title: 'Список' },
  { cmd: 'ordered', icon: 'format_list_numbered', title: 'Нумерованный список' },
  { cmd: 'link', icon: 'link', title: 'Ссылка', keys: 'Meta+K' },
];

/**
 * Поле текста новости с панелью форматирования. Вся математика каретки живёт
 * в lib/editor-commands.ts и покрыта тестами — здесь только связь с DOM.
 *
 * Три вещи, на которых такие редакторы ломаются, и как они решены:
 *  1. Клик по кнопке снимал бы выделение в поле раньше, чем сработает
 *     обработчик — гасим mousedown.
 *  2. Значение контролируемое, поэтому setSelectionRange сразу после
 *     изменения затрётся ре-рендером — восстанавливаем каретку после коммита.
 *  3. Программная замена value убивает нативный Cmd+Z, поэтому сначала
 *     пробуем execCommand: он пишет в стек отмены браузера.
 */
export function RichTextArea({
  value,
  onChange,
  placeholder,
  maxLength = 20_000,
  minRows = 12,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  minRows?: number;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);
  const [focused, setFocused] = useState(false);

  // восстановление каретки — только после коммита React
  useLayoutEffect(() => {
    const el = ref.current;
    const sel = pendingSel.current;
    if (!el || !sel) return;
    pendingSel.current = null;
    el.focus();
    el.setSelectionRange(sel[0], sel[1]);
  });

  // автовысота; пересчитывается и при возврате со вкладки превью,
  // где у скрытого поля scrollHeight равен нулю
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.offsetParent === null) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const write = (next: { value: string; selStart: number; selEnd: number }) => {
    const el = ref.current;
    // основной путь: правка через execCommand сохраняет нативную отмену
    if (el && document.activeElement === el) {
      el.setSelectionRange(0, el.value.length);
      if (document.execCommand('insertText', false, next.value)) {
        el.setSelectionRange(next.selStart, next.selEnd);
        return;
      }
    }
    pendingSel.current = [next.selStart, next.selEnd];
    onChange(next.value);
  };

  const run = (cmd: EditCommand) => {
    const el = ref.current;
    if (!el) return;
    write(applyCommand(cmd, value, el.selectionStart, el.selectionEnd));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey) {
      const key = e.key.toLowerCase();
      const cmd = key === 'b' ? 'bold' : key === 'i' ? 'italic' : key === 'k' ? 'link' : null;
      if (cmd) {
        e.preventDefault();
        run(cmd);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !mod) {
      const el = e.currentTarget;
      if (el.selectionStart !== el.selectionEnd) return;
      const next = continueList(value, el.selectionStart);
      if (next) {
        e.preventDefault();
        write(next);
      }
    }
  };

  const over = value.length > maxLength;

  return (
    <div
      className={clsx(
        'rounded-2xl border bg-surface-page-surf2 transition-colors',
        over ? 'border-negative' : focused ? 'border-stroke-brand' : 'border-transparent',
      )}
    >
      <div className="scrollbar-hide flex gap-1 overflow-x-auto border-b border-divider-additional px-2 py-2">
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.title}
            aria-label={t.title}
            aria-keyshortcuts={t.keys}
            // без этого клик по кнопке снимет выделение в поле
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.cmd)}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-default transition-colors hover:bg-comp-surface2-hover"
          >
            <Icon name={t.icon} size={20} />
          </button>
        ))}
      </div>

      <textarea
        ref={ref}
        id={id}
        value={value}
        rows={minRows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // нативный maxLength молча обрезал бы вставку из буфера — считаем сами
        className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-text-default outline-none placeholder:text-text-disabled"
      />

      <div className="flex items-center justify-between px-4 pb-2 text-xs text-text-disabled">
        <span>**жирный** · *курсив* · ## заголовок · - список · [текст](ссылка)</span>
        <span className={clsx(over && 'text-text-negative')} role={over ? 'status' : undefined}>
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
