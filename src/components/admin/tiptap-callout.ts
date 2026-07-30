import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      toggleCallout: () => ReturnType;
    };
  }
}

/**
 * Врезка-примечание — свой блочный узел, один в один повторяет Blockquote
 * из @tiptap/extension-blockquote (та же команда toggleWrap), но со своим
 * тегом-маркером и без готовой разметки под markdown-ввод: у врезки нет
 * общепринятого текстового эквивалента вроде `>` у цитаты.
 */
export const Callout = Node.create({
  name: 'callout',
  content: 'block+',
  group: 'block',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addCommands() {
    return {
      toggleCallout:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
});
