import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Node as PMNode } from '@tiptap/pm/model';
import {
  isSafeColor,
  isSafeFontFamily,
  isSafeFontSize,
  parseStoredBody,
  serializeDoc,
  type Doc,
  type NodeJson,
} from './richtext-doc';

/**
 * Договор между редактором админки и публичным рендерером.
 *
 * Оформление терялось молча и только у читателей: в Tiptap оно оставалось на
 * экране, а RichText.tsx его не рисовал — сверять глазами было нечего.
 * Тест строит НАСТОЯЩУЮ схему редактора (те же расширения, что в
 * RichTextEditor.tsx) и проверяет, что всё, что схема разрешает создать,
 * рендерер умеет показать.
 */

const schema = getSchema([
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  TextStyleKit.configure({ lineHeight: false, backgroundColor: false }),
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
    alignments: ['left', 'center', 'right'],
    defaultAlignment: 'left',
  }),
]);

/** Типы, которые публичный рендерер (RichText.tsx) разбирает явно. */
const RENDERED_NODES = [
  'doc',
  'paragraph',
  'text',
  'hardBreak',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'callout',
  'horizontalRule',
];
const RENDERED_MARKS = ['bold', 'italic', 'underline', 'strike', 'highlight', 'link', 'textStyle'];

describe('схема редактора не умеет ничего, чего не умеет рендерер', () => {
  it('все типы узлов покрыты', () => {
    const missing = Object.keys(schema.nodes).filter((n) => !RENDERED_NODES.includes(n));
    expect(missing).toEqual([]);
  });

  it('все марки покрыты', () => {
    const missing = Object.keys(schema.marks).filter((m) => !RENDERED_MARKS.includes(m));
    expect(missing).toEqual([]);
  });
});

describe('оформление переживает круг «сохранили → прочитали»', () => {
  const styled: Doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [
          {
            type: 'text',
            marks: [
              {
                type: 'textStyle',
                attrs: {
                  color: '#14b8a6',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.8em',
                },
              },
            ],
            text: 'цветной крупный текст',
          },
        ],
      },
    ],
  };

  it('цвет, шрифт и размер доходят до хранимой строки без потерь', () => {
    // ровно то, что делает редактор: JSON → схема → JSON → строка в БД
    const back = PMNode.fromJSON(schema, styled).toJSON() as Doc;
    const stored = serializeDoc(back);
    const marks = parseStoredBody(stored).content[0].content?.[0].marks;
    expect(marks?.[0].attrs).toMatchObject({
      color: '#14b8a6',
      fontFamily: 'var(--font-display)',
      fontSize: '1.8em',
    });
  });

  it('и проходят проверку рендерера — иначе он их не нарисует', () => {
    const attrs = styled.content[0].content?.[0].marks?.[0].attrs ?? {};
    expect(isSafeColor(attrs.color)).toBe(true);
    expect(isSafeFontFamily(attrs.fontFamily)).toBe(true);
    expect(isSafeFontSize(attrs.fontSize)).toBe(true);
  });
});

describe('вложенное содержимое не теряется', () => {
  /** Текст всех листьев узла — то, что читатель должен увидеть. */
  const leaves = (node: NodeJson): string[] => {
    if (node.type === 'text' && node.text) return [node.text];
    return (node.content ?? []).flatMap(leaves);
  };

  it('цитата из двух абзацев сохраняет оба (Enter внутри цитаты)', () => {
    const doc: Doc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'первый' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'второй' }] },
          ],
        },
      ],
    };
    const back = PMNode.fromJSON(schema, doc).toJSON() as Doc;
    // схема второй абзац разрешает — значит рендерер обязан его показать
    expect(leaves(back.content[0])).toEqual(['первый', 'второй']);
  });

  it('пункт списка держит вложенный список (Tab в списке)', () => {
    const doc: Doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'пункт' }] },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'вложенный' }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const back = PMNode.fromJSON(schema, doc).toJSON() as Doc;
    expect(leaves(back.content[0])).toEqual(['пункт', 'вложенный']);
  });

  it('перенос строки внутри абзаца — отдельный узел, а не текст', () => {
    const doc: Doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'строка' },
            { type: 'hardBreak' },
            { type: 'text', text: 'вторая' },
          ],
        },
      ],
    };
    const back = PMNode.fromJSON(schema, doc).toJSON() as Doc;
    const types = (back.content[0].content ?? []).map((n) => n.type);
    expect(types).toContain('hardBreak');
  });
});
