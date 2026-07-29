import { describe, expect, it } from 'vitest';
import { applyCommand, continueList } from './editor-commands';

/** `|` — каретка, `[...]` — выделение: так тесты читаются глазами. */
const run = (cmd: Parameters<typeof applyCommand>[0], marked: string): string => {
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  const value = marked.replace(/[[\]]/g, '');
  const r = applyCommand(cmd, value, start, end);
  return `${r.value.slice(0, r.selStart)}[${r.value.slice(r.selStart, r.selEnd)}]${r.value.slice(r.selEnd)}`;
};

describe('обёртка выделения', () => {
  it('жирный оборачивает и оставляет текст выделенным', () => {
    expect(run('bold', 'Меняйте [доллары] выгодно')).toBe('Меняйте **[доллары]** выгодно');
  });

  it('повторное нажатие снимает жирный, а не добавляет вторую пару', () => {
    expect(run('bold', 'Меняйте **[доллары]** выгодно')).toBe('Меняйте [доллары] выгодно');
  });

  it('снимает маркеры, если они попали внутрь выделения', () => {
    expect(run('bold', 'Меняйте [**доллары**] выгодно')).toBe('Меняйте [доллары] выгодно');
  });

  it('без выделения подставляет заглушку и выделяет её', () => {
    expect(run('bold', 'Начало []')).toBe('Начало **[текст]**');
  });

  it('курсив работает одиночной звёздочкой', () => {
    expect(run('italic', '[важно]')).toBe('*[важно]*');
  });
});

describe('ссылка', () => {
  it('оборачивает выделение и выделяет адрес для замены', () => {
    expect(run('link', 'Смотрите [курсы] тут')).toBe('Смотрите [курсы]([https://]) тут');
  });
});

describe('блочные команды', () => {
  it('заголовок ставится в начало строки', () => {
    expect(run('h2', '[Условия акции]')).toBe('[## Условия акции]');
  });

  it('повторное нажатие снимает заголовок', () => {
    expect(run('h2', '[## Условия акции]')).toBe('[Условия акции]');
  });

  it('заменяет чужой префикс, а не дописывает свой', () => {
    expect(run('bullet', '[## Условия]')).toBe('[- Условия]');
  });

  it('нумерует строки по порядку', () => {
    expect(run('ordered', '[раз\nдва\nтри]')).toBe('[1. раз\n2. два\n3. три]');
  });

  it('маркирует все выделенные строки', () => {
    expect(run('bullet', '[раз\nдва]')).toBe('[- раз\n- два]');
  });

  it('команда работает, даже если выделения нет — берётся текущая строка', () => {
    const value = 'Первая\nВторая';
    const caret = 8; // внутри «Вторая»
    const r = applyCommand('bullet', value, caret, caret);
    expect(r.value).toBe('Первая\n- Вторая');
  });
});

describe('продолжение списка по Enter', () => {
  it('маркированный список продолжается', () => {
    const value = '- раз';
    const r = continueList(value, value.length);
    expect(r?.value).toBe('- раз\n- ');
  });

  it('нумерация увеличивается', () => {
    const value = '1. раз';
    const r = continueList(value, value.length);
    expect(r?.value).toBe('1. раз\n2. ');
  });

  it('на пустом пункте список закрывается', () => {
    const value = '- раз\n- ';
    const r = continueList(value, value.length);
    expect(r?.value).toBe('- раз\n');
  });

  it('вне списка возвращает null — обычный перевод строки', () => {
    expect(continueList('обычный текст', 5)).toBeNull();
  });
});
