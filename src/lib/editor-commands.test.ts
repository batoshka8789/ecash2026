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

describe('applyCommand — новые команды', () => {
  it('выделение цветом оборачивает и снимается повторным нажатием', () => {
    const on = applyCommand('mark', 'цена выгодная', 0, 4);
    expect(on.value).toBe('==цена== выгодная');
    const off = applyCommand('mark', on.value, on.selStart, on.selEnd);
    expect(off.value).toBe('цена выгодная');
  });

  it('зачёркивание', () => {
    expect(applyCommand('strike', 'старая цена', 0, 6).value).toBe('~~старая~~ цена');
  });

  it('цитата ставит префикс на все строки выделения', () => {
    const r = applyCommand('quote', 'раз\nдва', 0, 7);
    expect(r.value).toBe('> раз\n> два');
  });

  it('врезка заменяет цитату, а не наслаивается', () => {
    expect(applyCommand('callout', '> раз', 2, 2).value).toBe('!> раз');
  });

  it('повторная цитата снимает префикс', () => {
    expect(applyCommand('quote', '> раз', 2, 2).value).toBe('раз');
  });

  it('разделитель встаёт отдельной строкой', () => {
    expect(applyCommand('divider', 'раз', 3, 3).value).toBe('раз\n---');
  });

  it('разделитель не плодит пустые строки', () => {
    expect(applyCommand('divider', 'раз\n', 4, 4).value).toBe('раз\n---');
  });

  it('каретка после разделителя стоит в конце вставки', () => {
    const r = applyCommand('divider', 'раз', 3, 3);
    expect(r.selStart).toBe(r.value.length);
    expect(r.selEnd).toBe(r.selStart);
  });
});

