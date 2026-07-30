import { Fragment, type ReactNode, useMemo } from 'react';
import { clsx } from 'clsx';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import {
  isSafeColor,
  isSafeFontFamily,
  isSafeFontSize,
  isSafeHref,
  isSafeTextAlign,
  parseStoredBody,
  type NodeJson,
} from '@/lib/richtext-doc';

/**
 * Рендер текста новости из JSON-документа Tiptap (см. lib/richtext-doc.ts).
 * Строит React-элементы обходом дерева по явному списку типов узлов/марок —
 * НИКОГДА не через `dangerouslySetInnerHTML`. Неизвестный тип узла или марки
 * (повреждённые данные, будущая несовместимость) просто пропускается, а не
 * роняет страницу.
 *
 * Классы совпадают с прежним рендерером разметки, чтобы живое превью в
 * админке и публичная страница выглядели как раньше.
 */
export function RichText({ source, className }: { source: string; className?: string }) {
  const doc = useMemo(() => parseStoredBody(source), [source]);
  if (doc.content.length === 0) return null;

  return (
    // первый блок без верхнего отступа — иначе текст «отъезжает» от картинки
    <div className={clsx('[&>*:first-child]:mt-0', className)}>
      {doc.content.map((node, i) => (
        <BlockView key={i} node={node} />
      ))}
    </div>
  );
}

/** Инлайновое содержимое одного узла-обёртки (пункт списка, цитата, врезка). */
function innerInline(node: NodeJson): NodeJson[] {
  const first = node.content?.[0];
  return first?.type === 'paragraph' ? (first.content ?? []) : (node.content ?? []);
}

/** Класс выравнивания абзаца/заголовка — только доверенные значения TextAlign. */
function alignClass(attrs: Record<string, unknown> | undefined): string | undefined {
  const align = attrs?.textAlign;
  if (!isSafeTextAlign(align) || align === 'left') return undefined;
  return align === 'center' ? 'text-center' : 'text-right';
}

function BlockView({ node }: { node: NodeJson }) {
  if (node.type === 'heading') {
    const level = node.attrs?.level === 3 ? 3 : 2;
    return level === 2 ? (
      <h2 className={clsx('mt-6 text-lg font-bold text-text-default sm:text-2xl', alignClass(node.attrs))}>
        <InlineView nodes={node.content ?? []} />
      </h2>
    ) : (
      <h3 className={clsx('mt-4 text-base font-bold text-text-default sm:text-lg', alignClass(node.attrs))}>
        <InlineView nodes={node.content ?? []} />
      </h3>
    );
  }

  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const cls = 'mt-3 flex flex-col gap-1 pl-5 text-sm leading-relaxed text-text-disabled';
    const items = (node.content ?? []).map((item, i) => (
      <li key={i}>
        <InlineView nodes={innerInline(item)} />
      </li>
    ));
    return node.type === 'orderedList' ? (
      <ol className={clsx(cls, 'list-decimal')}>{items}</ol>
    ) : (
      <ul className={clsx(cls, 'list-disc')}>{items}</ul>
    );
  }

  if (node.type === 'blockquote') {
    return (
      <blockquote className="mt-4 border-l-[3px] border-stroke-brand pl-4 text-sm italic leading-relaxed text-text-default sm:text-base">
        <InlineView nodes={innerInline(node)} />
      </blockquote>
    );
  }

  if (node.type === 'callout') {
    return (
      <div className="mt-4 flex gap-3 rounded-2xl bg-brand-hardsoft p-4">
        <Icon name="info" size={20} className="mt-0.5 shrink-0 text-text-brand" />
        <p className="text-sm leading-relaxed text-text-default">
          <InlineView nodes={innerInline(node)} />
        </p>
      </div>
    );
  }

  if (node.type === 'horizontalRule') {
    return <hr className="mt-6 border-0 border-t border-stroke-surface2" />;
  }

  if (node.type === 'paragraph') {
    const content = node.content ?? [];
    if (content.length === 0) return null;
    return (
      <p className={clsx('mt-3 text-sm leading-relaxed text-text-disabled', alignClass(node.attrs))}>
        <InlineView nodes={content} />
      </p>
    );
  }

  // неизвестный тип узла: пробуем показать хотя бы вложенный текст
  return node.content ? <InlineView nodes={node.content} /> : null;
}

function InlineView({ nodes }: { nodes: NodeJson[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type !== 'text' || !node.text) return null;
        return <Fragment key={i}>{applyMarks(node.text, node.marks)}</Fragment>;
      })}
    </>
  );
}

/**
 * Марки лежат плоским списком на текстовом узле (формат Tiptap), а не
 * вложенным деревом — оборачиваем текст по фиксированному порядку снаружи
 * внутрь. Порядок не влияет на итоговый вид: цвет/шрифт идут инлайновым
 * style, а он побеждает класс контейнера независимо от глубины вложенности.
 */
function applyMarks(text: string, marks: { type: string; attrs?: Record<string, unknown> }[] | undefined): ReactNode {
  let node: ReactNode = text;

  const highlight = marks?.find((m) => m.type === 'highlight');
  const bold = marks?.some((m) => m.type === 'bold');
  const italic = marks?.some((m) => m.type === 'italic');
  const underline = marks?.some((m) => m.type === 'underline');
  const strike = marks?.some((m) => m.type === 'strike');
  const link = marks?.find((m) => m.type === 'link');
  const style = marks?.find((m) => m.type === 'textStyle');

  if (highlight) {
    const hex = highlight.attrs?.color;
    // Свой цвет подложки — только из проверенных #rrggbb, иначе фирменный
    // фон по умолчанию (тот же оттенок, что был единственным раньше).
    node = isSafeColor(hex) ? (
      <mark className="rounded px-1 py-0.5 font-medium text-text-default" style={{ backgroundColor: `${hex}33` }}>
        {node}
      </mark>
    ) : (
      // Цвет — в подложке, буквы обычные. Фирменным цветом по фирменной же
      // подложке контраст выходил ~2.8:1 в светлой теме, то есть ниже порога
      // читаемости; так он высокий в обеих темах, а выделение всё равно
      // читается цветным — как маркером.
      <mark className="rounded bg-brand-hardsoft px-1 py-0.5 font-medium text-text-default">{node}</mark>
    );
  }
  if (strike) node = <s className="opacity-70">{node}</s>;
  if (underline) node = <u>{node}</u>;
  if (italic) node = <em>{node}</em>;
  if (bold) node = <strong className="font-semibold text-text-default">{node}</strong>;

  if (style?.attrs) {
    const color = style.attrs.color;
    const font = style.attrs.fontFamily;
    const size = style.attrs.fontSize;
    const css: React.CSSProperties = {};
    if (isSafeColor(color)) css.color = color;
    if (isSafeFontFamily(font)) css.fontFamily = font;
    if (isSafeFontSize(size)) css.fontSize = size;
    if (css.color || css.fontFamily || css.fontSize) node = <span style={css}>{node}</span>;
  }

  if (link?.attrs) {
    const href = link.attrs.href;
    if (typeof href === 'string' && isSafeHref(href)) {
      const cls = 'text-text-brand underline underline-offset-2';
      // внутренние ссылки — через Link из i18n-навигации, чтобы не терять локаль
      node = href.startsWith('/') ? (
        <Link href={href} className={cls}>
          {node}
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {node}
        </a>
      );
    }
  }

  return node;
}
