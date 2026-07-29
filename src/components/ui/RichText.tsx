import { Fragment, useMemo } from 'react';
import { clsx } from 'clsx';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { parseRichText, type Block, type Inline } from '@/lib/richtext';

/**
 * Рендер размеченного текста новости. Строит React-элементы из дерева, а не
 * HTML-строку: `dangerouslySetInnerHTML` в проекте не используется нигде и
 * санитайзера нет — при таком рендере он и не нужен, вставить разметку
 * физически некуда.
 *
 * Классы совпадают с карточкой ленты, чтобы живое превью в админке и
 * публичная страница выглядели одинаково.
 */
export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = useMemo(() => parseRichText(source), [source]);
  if (blocks.length === 0) return null;

  return (
    // первый блок без верхнего отступа — иначе текст «отъезжает» от картинки
    <div className={clsx('[&>*:first-child]:mt-0', className)}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.type === 'heading') {
    return block.level === 2 ? (
      <h2 className="mt-6 text-lg font-bold text-text-default sm:text-2xl">
        <InlineView nodes={block.children} />
      </h2>
    ) : (
      <h3 className="mt-4 text-base font-bold text-text-default sm:text-lg">
        <InlineView nodes={block.children} />
      </h3>
    );
  }

  if (block.type === 'list') {
    const cls = 'mt-3 flex flex-col gap-1 pl-5 text-sm leading-relaxed text-text-disabled';
    const items = block.items.map((item, i) => (
      <li key={i}>
        <InlineView nodes={item} />
      </li>
    ));
    return block.ordered ? (
      <ol className={clsx(cls, 'list-decimal')}>{items}</ol>
    ) : (
      <ul className={clsx(cls, 'list-disc')}>{items}</ul>
    );
  }

  if (block.type === 'quote') {
    return (
      <blockquote className="mt-4 border-l-[3px] border-stroke-brand pl-4 text-sm italic leading-relaxed text-text-default sm:text-base">
        <InlineView nodes={block.children} />
      </blockquote>
    );
  }

  if (block.type === 'callout') {
    return (
      <div className="mt-4 flex gap-3 rounded-2xl bg-brand-hardsoft p-4">
        <Icon name="info" size={20} className="mt-0.5 shrink-0 text-text-brand" />
        <p className="text-sm leading-relaxed text-text-default">
          <InlineView nodes={block.children} />
        </p>
      </div>
    );
  }

  if (block.type === 'divider') {
    return <hr className="mt-6 border-0 border-t border-stroke-surface2" />;
  }

  return (
    <p className="mt-3 text-sm leading-relaxed text-text-disabled">
      <InlineView nodes={block.children} />
    </p>
  );
}

function InlineView({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === 'text') return <Fragment key={i}>{node.value}</Fragment>;

        if (node.type === 'bold') {
          return (
            <strong key={i} className="font-semibold text-text-default">
              <InlineView nodes={node.children} />
            </strong>
          );
        }

        if (node.type === 'italic') {
          return (
            <em key={i}>
              <InlineView nodes={node.children} />
            </em>
          );
        }

        if (node.type === 'strike') {
          return (
            <s key={i} className="opacity-70">
              <InlineView nodes={node.children} />
            </s>
          );
        }

        if (node.type === 'mark') {
          // Цвет — в подложке, буквы обычные. Фирменным цветом по фирменной же
          // подложке контраст выходил ~2.8:1 в светлой теме, то есть ниже
          // порога читаемости; так он высокий в обеих темах, а выделение
          // всё равно читается цветным — как маркером.
          return (
            <mark
              key={i}
              className="rounded bg-brand-hardsoft px-1 py-0.5 font-medium text-text-default"
            >
              <InlineView nodes={node.children} />
            </mark>
          );
        }

        const cls = 'text-text-brand underline underline-offset-2';
        // внутренние ссылки — через Link из i18n-навигации, чтобы не терять локаль
        return node.href.startsWith('/') ? (
          <Link key={i} href={node.href} className={cls}>
            <InlineView nodes={node.children} />
          </Link>
        ) : (
          <a key={i} href={node.href} target="_blank" rel="noopener noreferrer" className={cls}>
            <InlineView nodes={node.children} />
          </a>
        );
      })}
    </>
  );
}
