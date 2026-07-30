'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CharacterCount } from '@tiptap/extension-character-count';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Callout } from './tiptap-callout';
import { useAdminStrings, type AdminStrings } from './strings';
import { FONT_STACK, parseStoredBody, serializeDoc, type Doc, type FontKey } from '@/lib/richtext-doc';

const COLORS = ['#f15a25', '#009944', '#fa5050', '#0066ff', '#ad33ad', '#ffcc00'];
const FONTS: FontKey[] = ['sans', 'serif', 'mono'];

type Tool = {
  key: string;
  icon: string;
  title: (t: AdminStrings) => string;
  keys?: string;
  run: (editor: Editor) => void;
  active: string | ((editor: Editor) => boolean);
};

const GROUPS: Tool[][] = [
  [
    { key: 'bold', icon: 'format_bold', title: (t) => t.bold, keys: 'Meta+B', active: 'bold', run: (e) => e.chain().focus().toggleBold().run() },
    { key: 'italic', icon: 'format_italic', title: (t) => t.italic, keys: 'Meta+I', active: 'italic', run: (e) => e.chain().focus().toggleItalic().run() },
    { key: 'underline', icon: 'format_underlined', title: (t) => t.underline, keys: 'Meta+U', active: 'underline', run: (e) => e.chain().focus().toggleUnderline().run() },
    { key: 'strike', icon: 'strikethrough_s', title: (t) => t.strike, active: 'strike', run: (e) => e.chain().focus().toggleStrike().run() },
    { key: 'mark', icon: 'ink_highlighter', title: (t) => t.mark, active: 'highlight', run: (e) => e.chain().focus().toggleHighlight().run() },
  ],
  [
    { key: 'h2', icon: 'format_h2', title: (t) => t.h2, active: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'h3', icon: 'format_h3', title: (t) => t.h3, active: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  ],
  [
    { key: 'bullet', icon: 'format_list_bulleted', title: (t) => t.bullet, active: 'bulletList', run: (e) => e.chain().focus().toggleBulletList().run() },
    { key: 'ordered', icon: 'format_list_numbered', title: (t) => t.ordered, active: 'orderedList', run: (e) => e.chain().focus().toggleOrderedList().run() },
  ],
  [
    { key: 'quote', icon: 'format_quote', title: (t) => t.quote, active: 'blockquote', run: (e) => e.chain().focus().toggleBlockquote().run() },
    { key: 'callout', icon: 'lightbulb', title: (t) => t.callout, active: 'callout', run: (e) => e.chain().focus().toggleCallout().run() },
    { key: 'divider', icon: 'horizontal_rule', title: (t) => t.divider, active: () => false, run: (e) => e.chain().focus().setHorizontalRule().run() },
  ],
];

/** `ecash.kz/...` → `https://ecash.kz/...`; опасные схемы отклоняются. */
function normalizeHref(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^(javascript|data|vbscript):/i.test(v)) return null;
  if (v.startsWith('/') || /^(https?:\/\/|mailto:)/i.test(v)) return v;
  return `https://${v}`;
}

/** Кнопка панели с выпадающей панелькой (цвет, шрифт) — закрывается по клику вовне и Esc. */
function ToolbarPopover({
  icon,
  label,
  active,
  children,
}: {
  icon: string;
  label: string;
  active?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors',
          active || open ? 'bg-brand-hardsoft text-text-brand' : 'text-text-default hover:bg-comp-surface2-hover',
        )}
      >
        <Icon name={icon} size={20} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-[176px] rounded-2xl border border-stroke-surface2 bg-surface-page-surf1 p-3 shadow-[0_16px_32px_-8px_rgba(12,12,13,0.4)]">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function ColorTool({ editor, t }: { editor: Editor; t: AdminStrings }) {
  const color = useEditorState({
    editor,
    selector: ({ editor }) => (editor.getAttributes('textStyle').color as string | undefined) ?? null,
  });

  return (
    <ToolbarPopover icon="format_color_text" label={t.textColor} active={Boolean(color)}>
      {(close) => (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-6 gap-2">
            <button
              type="button"
              title={t.colorDefault}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                close();
              }}
              className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-full border border-stroke-surface3 bg-surface-page-surf2 text-text-disabled',
                !color && 'ring-2 ring-stroke-brand ring-offset-1 ring-offset-surface-page-surf1',
              )}
            >
              <Icon name="close" size={14} />
            </button>
            {COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setColor(hex).run();
                  close();
                }}
                style={{ backgroundColor: hex }}
                className={clsx(
                  'h-7 w-7 rounded-full border border-black/10',
                  color === hex && 'ring-2 ring-stroke-brand ring-offset-1 ring-offset-surface-page-surf1',
                )}
              />
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-text-disabled">
            <input
              type="color"
              value={color ?? '#f15a25'}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              className="h-7 w-7 cursor-pointer rounded-full border border-stroke-surface3 bg-transparent p-0"
            />
            {t.colorCustom}
          </label>
        </div>
      )}
    </ToolbarPopover>
  );
}

function FontTool({ editor, t }: { editor: Editor; t: AdminStrings }) {
  // Марка хранит готовое значение CSS-переменной (FONT_STACK[key]), а не
  // ключ: так сам редактор рендерит тот же шрифт, что потом увидит
  // посетитель сайта, а не дженерик `font-family: serif` от самого Tiptap.
  const font = useEditorState({
    editor,
    selector: ({ editor }) => (editor.getAttributes('textStyle').fontFamily as string | undefined) ?? null,
  });
  const FONT_LABEL: Record<FontKey, string> = { sans: t.fontSans, serif: t.fontSerif, mono: t.fontMono };

  return (
    <ToolbarPopover icon="font_download" label={t.fontFamily} active={Boolean(font)}>
      {(close) => (
        <div className="flex flex-col gap-1">
          {FONTS.map((key) => (
            <button
              key={key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (key === 'sans') editor.chain().focus().unsetFontFamily().run();
                else editor.chain().focus().setFontFamily(FONT_STACK[key]).run();
                close();
              }}
              style={{ fontFamily: FONT_STACK[key] }}
              className={clsx(
                'rounded-lg px-3 py-2 text-left text-sm text-text-default transition-colors hover:bg-comp-surface2-hover',
                (font ?? FONT_STACK.sans) === FONT_STACK[key] && 'bg-brand-hardsoft text-text-brand',
              )}
            >
              {FONT_LABEL[key]}
            </button>
          ))}
        </div>
      )}
    </ToolbarPopover>
  );
}

function LinkTool({ editor, t }: { editor: Editor; t: AdminStrings }) {
  const [draft, setDraft] = useState<string | null>(null);
  const active = useEditorState({ editor, selector: ({ editor }) => editor.isActive('link') });
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft !== null) inputRef.current?.focus();
  }, [draft]);

  useEffect(() => {
    if (draft === null) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDraft(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [draft]);

  const apply = () => {
    const href = draft ? normalizeHref(draft) : null;
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setDraft(null);
      return;
    }
    if (editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .insertContent([{ type: 'text', text: href.replace(/^https?:\/\//, ''), marks: [{ type: 'link', attrs: { href } }] }])
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setDraft(null);
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        title={t.link}
        aria-label={t.link}
        aria-keyshortcuts="Meta+K"
        aria-pressed={active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setDraft((editor.getAttributes('link').href as string | undefined) ?? '')}
        className={clsx(
          'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors',
          active ? 'bg-brand-hardsoft text-text-brand' : 'text-text-default hover:bg-comp-surface2-hover',
        )}
      >
        <Icon name="link" size={20} />
      </button>
      {draft !== null && (
        <div className="absolute left-0 top-full z-10 mt-1 flex w-64 items-center gap-1 rounded-2xl border border-stroke-surface2 bg-surface-page-surf1 p-2 shadow-[0_16px_32px_-8px_rgba(12,12,13,0.4)]">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(null);
              }
            }}
            placeholder={t.linkPlaceholder}
            className="h-9 min-w-0 flex-1 rounded-lg bg-surface-page-surf2 px-2 text-sm text-text-default outline-none placeholder:text-text-disabled"
          />
          <button
            type="button"
            title={t.linkApply}
            onMouseDown={(e) => e.preventDefault()}
            onClick={apply}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-brand hover:bg-comp-surface2-hover"
          >
            <Icon name="check" size={18} />
          </button>
          {active && (
            <button
              type="button"
              title={t.linkRemove}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                setDraft(null);
              }}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-negative hover:bg-comp-surface2-hover"
            >
              <Icon name="link_off" size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * WYSIWYG-редактор текста новости на Tiptap: панель форматирования правит
 * текст «как в Word», а не вставляет символы разметки в поле — прежний
 * RichTextArea был обычной textarea, показывавшей admin'у сырые `**`/`##`/
 * `~~`, что и выглядело как испорченный текст.
 *
 * Хранимое значение — JSON-документ Tiptap (см. lib/richtext-doc.ts), не
 * строка. `value`/`onChange` читаются и пишутся только при монтировании и на
 * каждое изменение соответственно: контент задаётся редактору ОДИН раз при
 * создании (так работает useEditor), а переключение между локалями в
 * NewsEditor размонтирует и создаёт редактор заново через key={locale} —
 * поэтому здесь нет ни setContent, ни риска затереть каретку чужим апдейтом.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  maxLength = 20_000,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  id?: string;
}) {
  const t = useAdminStrings();

  const editor = useEditor({
    immediatelyRender: false,
    content: parseStoredBody(value) as unknown as Record<string, unknown>,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Callout,
      TextStyleKit.configure({ fontSize: false, lineHeight: false, backgroundColor: false }),
      Highlight,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      CharacterCount.configure({ limit: null }),
    ],
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class:
          'min-h-[220px] px-4 py-3 text-sm leading-relaxed text-text-default outline-none [&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0',
      },
    },
    onUpdate: ({ editor }) => onChange(serializeDoc(editor.getJSON() as Doc)),
  });

  const focused = useEditorState({ editor, selector: ({ editor }) => editor?.isFocused ?? false });
  const activeMap = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return {};
      const map: Record<string, boolean> = {};
      for (const group of GROUPS) {
        for (const tool of group) {
          map[tool.key] = typeof tool.active === 'function' ? tool.active(editor) : editor.isActive(tool.active);
        }
      }
      return map;
    },
  });
  const characters = useEditorState({
    editor,
    selector: ({ editor }) => editor?.storage.characterCount.characters() ?? 0,
  });

  if (!editor) return null;

  const active = activeMap ?? {};
  const over = (characters ?? 0) > maxLength;

  return (
    <div
      className={clsx(
        'rounded-2xl border bg-surface-page-surf2 transition-colors',
        over ? 'border-negative' : focused ? 'border-stroke-brand' : 'border-transparent',
      )}
    >
      <div className="scrollbar-hide flex items-center gap-1 overflow-x-auto border-b border-divider-additional px-2 py-2">
        {GROUPS.map((group, gi) => (
          <div key={gi} className="flex shrink-0 items-center gap-1">
            {gi > 0 && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-divider-additional" />}
            {group.map((tool) => {
              const label = tool.title(t);
              return (
                <button
                  key={tool.key}
                  type="button"
                  title={tool.keys ? `${label} (${tool.keys.replace('Meta', '⌘')})` : label}
                  aria-label={label}
                  aria-keyshortcuts={tool.keys}
                  aria-pressed={active[tool.key] ?? false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => tool.run(editor)}
                  className={clsx(
                    'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors',
                    active[tool.key]
                      ? 'bg-brand-hardsoft text-text-brand'
                      : 'text-text-default hover:bg-comp-surface2-hover',
                  )}
                >
                  <Icon name={tool.icon} size={20} />
                </button>
              );
            })}
          </div>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-divider-additional" />
        <LinkTool editor={editor} t={t} />
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-divider-additional" />
        <ColorTool editor={editor} t={t} />
        <FontTool editor={editor} t={t} />
      </div>

      <EditorContent editor={editor} />

      <div className="flex items-center justify-end px-4 pb-3 pt-1 text-xs text-text-disabled">
        <span className={clsx(over && 'text-text-negative')} role={over ? 'status' : undefined}>
          {characters ?? 0} / {maxLength}
        </span>
      </div>
    </div>
  );
}
