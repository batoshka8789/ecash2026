'use client';

import { useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CharacterCount } from '@tiptap/extension-character-count';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Callout } from './tiptap-callout';
import { ToolbarPopover } from './ToolbarPopover';
import { useAdminStrings, type AdminStrings } from './strings';
import {
  FONT_STACK,
  SIZE_STACK,
  parseStoredBody,
  serializeDoc,
  type Doc,
  type FontKey,
  type SizeKey,
} from '@/lib/richtext-doc';

/** Палитра пикеров цвета/выделения — фирменные + нейтральный спектр, 2 ряда по 6. */
const COLORS = [
  '#f15a25',
  '#009944',
  '#fa5050',
  '#0066ff',
  '#ad33ad',
  '#ffcc00',
  '#ff8a3d',
  '#14b8a6',
  '#ec4899',
  '#6366f1',
  '#78716c',
  '#0ea5e9',
];
const FONTS: FontKey[] = ['sans', 'serif', 'display', 'geometric', 'mono'];
const SIZES: SizeKey[] = ['small', 'normal', 'large', 'huge'];

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
  [
    { key: 'alignLeft', icon: 'format_align_left', title: (t) => t.alignLeft, active: (e) => e.isActive({ textAlign: 'left' }), run: (e) => e.chain().focus().setTextAlign('left').run() },
    { key: 'alignCenter', icon: 'format_align_center', title: (t) => t.alignCenter, active: (e) => e.isActive({ textAlign: 'center' }), run: (e) => e.chain().focus().setTextAlign('center').run() },
    { key: 'alignRight', icon: 'format_align_right', title: (t) => t.alignRight, active: (e) => e.isActive({ textAlign: 'right' }), run: (e) => e.chain().focus().setTextAlign('right').run() },
  ],
];

const CLEAR_FORMAT: Tool = {
  key: 'clearFormat',
  icon: 'format_clear',
  title: (t) => t.clearFormat,
  active: () => false,
  run: (e) => e.chain().focus().unsetAllMarks().clearNodes().run(),
};

/** `ecash.kz/...` → `https://ecash.kz/...`; опасные схемы отклоняются. */
function normalizeHref(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^(javascript|data|vbscript):/i.test(v)) return null;
  if (v.startsWith('/') || /^(https?:\/\/|mailto:)/i.test(v)) return v;
  return `https://${v}`;
}

/** Кружок-превью текущего цвета на кнопке — видно результат, не только иконку. */
function Swatch({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className={clsx('absolute bottom-1 right-1 h-2 w-2 rounded-full ring-1 ring-surface-page-surf2', !color && 'bg-text-disabled')}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

function ColorGrid({
  value,
  onPick,
  onCustom,
  onReset,
  resetLabel,
  customLabel,
}: {
  value: string | null;
  onPick: (hex: string) => void;
  onCustom: (hex: string) => void;
  onReset: () => void;
  resetLabel: string;
  customLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-6 gap-2">
        <button
          type="button"
          title={resetLabel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onReset}
          className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-full border border-stroke-surface3 bg-surface-page-surf2 text-text-disabled transition-transform hover:scale-110',
            !value && 'ring-2 ring-stroke-brand ring-offset-1 ring-offset-surface-page-surf1',
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
            onClick={() => onPick(hex)}
            style={{ backgroundColor: hex }}
            className={clsx(
              'h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110',
              value === hex && 'ring-2 ring-stroke-brand ring-offset-1 ring-offset-surface-page-surf1',
            )}
          />
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-text-disabled">
        <span
          className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-stroke-surface3"
          style={{
            background:
              'conic-gradient(from 0deg, #f15a25, #ffcc00, #009944, #0ea5e9, #6366f1, #ad33ad, #fa5050, #f15a25)',
          }}
        >
          <input
            type="color"
            value={value ?? '#f15a25'}
            onChange={(e) => onCustom(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        {customLabel}
      </label>
    </div>
  );
}

function HighlightTool({ editor, t }: { editor: Editor; t: AdminStrings }) {
  const color = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor.isActive('highlight') ? ((editor.getAttributes('highlight').color as string | undefined) ?? '#f15a25') : null,
  });

  return (
    <ToolbarPopover icon="ink_highlighter" label={t.mark} active={color !== null}>
      {(close) => (
        <ColorGrid
          value={color}
          resetLabel={t.colorDefault}
          customLabel={t.colorCustom}
          onReset={() => {
            editor.chain().focus().unsetHighlight().run();
            close();
          }}
          onPick={(hex) => {
            editor.chain().focus().setHighlight({ color: hex }).run();
            close();
          }}
          onCustom={(hex) => editor.chain().focus().setHighlight({ color: hex }).run()}
        />
      )}
    </ToolbarPopover>
  );
}

function ColorTool({ editor, t }: { editor: Editor; t: AdminStrings }) {
  const color = useEditorState({
    editor,
    selector: ({ editor }) => (editor.getAttributes('textStyle').color as string | undefined) ?? null,
  });

  return (
    <div className="relative">
      <ToolbarPopover icon="format_color_text" label={t.textColor} active={Boolean(color)}>
        {(close) => (
          <ColorGrid
            value={color}
            resetLabel={t.colorDefault}
            customLabel={t.colorCustom}
            onReset={() => {
              editor.chain().focus().unsetColor().run();
              close();
            }}
            onPick={(hex) => {
              editor.chain().focus().setColor(hex).run();
              close();
            }}
            onCustom={(hex) => editor.chain().focus().setColor(hex).run()}
          />
        )}
      </ToolbarPopover>
      <Swatch color={color} />
    </div>
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
  const LABEL: Record<FontKey, string> = {
    sans: t.fontSans,
    serif: t.fontSerif,
    display: t.fontDisplay,
    geometric: t.fontGeometric,
    mono: t.fontMono,
  };

  return (
    <ToolbarPopover icon="font_download" label={t.fontFamily} active={Boolean(font)} panelClassName="min-w-[220px]">
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
                'rounded-lg px-3 py-2.5 text-left text-base text-text-default transition-colors hover:bg-comp-surface2-hover',
                (font ?? FONT_STACK.sans) === FONT_STACK[key] && 'bg-brand-hardsoft text-text-brand',
              )}
            >
              {LABEL[key]}
            </button>
          ))}
        </div>
      )}
    </ToolbarPopover>
  );
}

function FontSizeTool({ editor, t }: { editor: Editor; t: AdminStrings }) {
  const size = useEditorState({
    editor,
    selector: ({ editor }) => (editor.getAttributes('textStyle').fontSize as string | undefined) ?? null,
  });
  const LABEL: Record<SizeKey, string> = { small: 'S', normal: 'M', large: 'L', huge: 'XL' };
  const SCALE: Record<SizeKey, string> = { small: '0.8em', normal: '1em', large: '1.3em', huge: '1.8em' };

  return (
    <ToolbarPopover icon="format_size" label={t.fontSize} active={Boolean(size)} panelClassName="min-w-[180px]">
      {(close) => (
        <div className="flex items-end gap-1">
          {SIZES.map((key) => (
            <button
              key={key}
              type="button"
              title={LABEL[key]}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (key === 'normal') editor.chain().focus().unsetFontSize().run();
                else editor.chain().focus().setFontSize(SIZE_STACK[key as Exclude<SizeKey, 'normal'>]).run();
                close();
              }}
              className={clsx(
                'flex h-11 flex-1 items-center justify-center rounded-lg font-semibold text-text-default transition-colors hover:bg-comp-surface2-hover',
                (size ? key !== 'normal' && SIZE_STACK[key as Exclude<SizeKey, 'normal'>] === size : key === 'normal') &&
                  'bg-brand-hardsoft text-text-brand',
              )}
              style={{ fontSize: SCALE[key] }}
            >
              {LABEL[key]}
            </button>
          ))}
        </div>
      )}
    </ToolbarPopover>
  );
}

function LinkTool({ editor, t }: { editor: Editor; t: AdminStrings }) {
  const [draft, setDraft] = useState('');
  const active = useEditorState({ editor, selector: ({ editor }) => editor.isActive('link') });
  const inputRef = useRef<HTMLInputElement>(null);

  const apply = (close: () => void) => {
    const href = draft ? normalizeHref(draft) : null;
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      close();
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
    close();
  };

  return (
    <ToolbarPopover
      icon="link"
      label={t.link}
      active={active}
      panelClassName="w-64"
      onBeforeOpen={() => {
        setDraft((editor.getAttributes('link').href as string | undefined) ?? '');
        requestAnimationFrame(() => inputRef.current?.focus());
      }}
    >
      {(close) => (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply(close);
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              }
            }}
            placeholder={t.linkPlaceholder}
            className="h-9 min-w-0 flex-1 rounded-lg bg-surface-page-surf2 px-2 text-sm text-text-default outline-none placeholder:text-text-disabled"
          />
          <button
            type="button"
            title={t.linkApply}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(close)}
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
                close();
              }}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-negative hover:bg-comp-surface2-hover"
            >
              <Icon name="link_off" size={18} />
            </button>
          )}
        </div>
      )}
    </ToolbarPopover>
  );
}

/** Мини-панель на выделении текста — быстрые действия под рукой, как в Notion/Medium. */
function SelectionBubble({ editor, t }: { editor: Editor; t: AdminStrings }) {
  const QUICK: Tool[] = [
    GROUPS[0][0],
    GROUPS[0][1],
    GROUPS[0][2],
    { key: 'mark', icon: 'ink_highlighter', title: (t) => t.mark, active: 'highlight', run: (e) => e.chain().focus().toggleHighlight().run() },
  ];
  const active = useEditorState({
    editor,
    selector: ({ editor }) => Object.fromEntries(QUICK.map((tool) => [tool.key, typeof tool.active === 'function' ? tool.active(editor) : editor.isActive(tool.active)])),
  });

  return (
    <BubbleMenu editor={editor} className="flex items-center gap-0.5 rounded-xl border border-stroke-surface2 bg-surface-page-surf1 p-1 shadow-[0_20px_48px_-12px_rgba(12,12,13,0.6)]">
      {QUICK.map((tool) => (
        <button
          key={tool.key}
          type="button"
          title={tool.title(t)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => tool.run(editor)}
          className={clsx(
            'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors',
            active[tool.key] ? 'bg-brand-hardsoft text-text-brand' : 'text-text-default hover:bg-comp-surface2-hover',
          )}
        >
          <Icon name={tool.icon} size={18} />
        </button>
      ))}
    </BubbleMenu>
  );
}

function ToolButton({
  tool,
  editor,
  active,
  t,
}: {
  tool: Tool;
  editor: Editor;
  active: Record<string, boolean>;
  t: AdminStrings;
}) {
  const label = tool.title(t);
  return (
    <button
      type="button"
      title={tool.keys ? `${label} (${tool.keys.replace('Meta', '⌘')})` : label}
      aria-label={label}
      aria-keyshortcuts={tool.keys}
      aria-pressed={active[tool.key] ?? false}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => tool.run(editor)}
      className={clsx(
        'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors',
        active[tool.key] ? 'bg-brand-hardsoft text-text-brand' : 'text-text-default hover:bg-comp-surface2-hover',
      )}
    >
      <Icon name={tool.icon} size={20} />
    </button>
  );
}

/**
 * WYSIWYG-редактор текста новости на Tiptap: панель правит текст «как в
 * Word», а не вставляет символы разметки в поле — прежний RichTextArea был
 * обычной textarea, показывавшей admin'у сырые `**`/`##`/`~~`, что и
 * выглядело как испорченный текст.
 *
 * Хранимое значение — JSON-документ Tiptap (см. lib/richtext-doc.ts), не
 * строка. `value`/`onChange` читаются и пишутся только при монтировании и на
 * каждое изменение соответственно: контент задаётся редактору ОДИН раз при
 * создании (так работает useEditor), а переключение между локалями в
 * NewsEditor размонтирует и создаёт редактор заново через key={locale} —
 * поэтому здесь нет ни setContent, ни риска затереть каретку чужим апдейтом.
 *
 * Все выпадающие панели (цвет/шрифт/размер/ссылка/выделение) — через
 * ToolbarPopover, который выносит их порталом в document.body. Без этого их
 * обрезал бы overflow-x-auto самой панели инструментов: если задать только
 * overflow-x, оverflow-y по спецификации CSS молча становится auto — так
 * палитра цвета и список шрифтов физически существовали в DOM, но не были
 * видны НИ ПИКСЕЛЕМ (найдено и исправлено по прямой жалобе пользователя).
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
      TextStyleKit.configure({ lineHeight: false, backgroundColor: false }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'], defaultAlignment: 'left' }),
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
  if (!editor) return null;

  // Обычный проброс через useEditorState здесь не годится: его снимок
  // остаётся нулевым, пока не пройдёт первая транзакция после создания
  // редактора (переход editor null → Editor транзакцией не считается), из-за
  // чего счётчик открытой существующей новости показывал «0 / 20000» до
  // первого нажатия клавиши. Читаем значение прямо при рендере — activeMap
  // выше уже перерисовывает компонент на каждую транзакцию, так что здесь
  // достаточно всегда актуального чтения без своей подписки.
  const characters = editor.storage.characterCount.characters();

  const active = activeMap ?? {};
  const over = characters > maxLength;

  return (
    <div
      className={clsx(
        'rounded-2xl border bg-surface-page-surf2 transition-colors',
        over ? 'border-negative' : focused ? 'border-stroke-brand' : 'border-transparent',
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-divider-additional px-2 py-2">
        {GROUPS.map((group, gi) => (
          <div key={gi} className="flex shrink-0 items-center gap-1">
            {gi > 0 && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-divider-additional" />}
            {group.map((tool) => (
              <ToolButton key={tool.key} tool={tool} editor={editor} active={active} t={t} />
            ))}
          </div>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-divider-additional" />
        <HighlightTool editor={editor} t={t} />
        <LinkTool editor={editor} t={t} />
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-divider-additional" />
        <ColorTool editor={editor} t={t} />
        <FontTool editor={editor} t={t} />
        <FontSizeTool editor={editor} t={t} />
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-divider-additional" />
        <ToolButton tool={CLEAR_FORMAT} editor={editor} active={active} t={t} />
      </div>

      <SelectionBubble editor={editor} t={t} />
      <EditorContent editor={editor} />

      <div className="flex items-center justify-end px-4 pb-3 pt-1 text-xs text-text-disabled">
        <span className={clsx(over && 'text-text-negative')} role={over ? 'status' : undefined}>
          {characters} / {maxLength}
        </span>
      </div>
    </div>
  );
}
