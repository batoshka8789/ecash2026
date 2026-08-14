import { describe, expect, it } from 'vitest';
import { changePasswordBody } from './schemas';

/**
 * Схема смены пароля из профиля. Форма и сервер валидируют одним и тем же
 * кодом, поэтому здесь проверяется контракт для обоих сразу.
 */

const ok = { currentPassword: 'старый123', newPassword: 'новый12345', newPassword2: 'новый12345' };

describe('changePasswordBody', () => {
  it('корректный ввод проходит', () => {
    expect(changePasswordBody.safeParse(ok).success).toBe(true);
  });

  it('пустой текущий пароль — отказ с указанием поля', () => {
    const r = changePasswordBody.safeParse({ ...ok, currentPassword: '' });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].path[0]).toBe('currentPassword');
  });

  it('текущий пароль НЕ ограничен по длине: он уже существует, правила могли быть другими', () => {
    // короткий и без цифр — для нового такой не прошёл бы, для текущего должен
    const r = changePasswordBody.safeParse({ ...ok, currentPassword: 'abc' });
    expect(r.success).toBe(true);
  });

  it.each([
    ['короче 8 символов', 'кор1'],
    ['без цифры', 'безцифрыздесь'],
  ])('новый пароль %s — отказ', (_label, newPassword) => {
    const r = changePasswordBody.safeParse({ ...ok, newPassword, newPassword2: newPassword });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].path[0]).toBe('newPassword');
  });

  it('повтор не совпал — ошибка привязана к полю повтора', () => {
    const r = changePasswordBody.safeParse({ ...ok, newPassword2: 'другой12345' });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]).toMatchObject({
      path: ['newPassword2'],
      message: 'errors.passwordMatch',
    });
  });

  /**
   * Без этой проверки запрос уходил бы в ядро, ничего не менял, а человек
   * видел бы «пароль изменён» — и считал, что смена прошла.
   */
  it('новый пароль совпадает с текущим — отказ до отправки', () => {
    const same = 'одинаков12345';
    const r = changePasswordBody.safeParse({
      currentPassword: same,
      newPassword: same,
      newPassword2: same,
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]).toMatchObject({
      path: ['newPassword'],
      message: 'errors.passwordSame',
    });
  });
});
