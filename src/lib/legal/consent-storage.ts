import { CONSENT_VERSION } from './consent';

/**
 * Принятое согласие — между вкладкой с документом и вкладкой регистрации.
 *
 * Зачем хранилище: документ открывается в НОВОЙ вкладке, чтобы наполовину
 * заполненная форма регистрации не потерялась. Значит вкладке с формой нужно
 * как-то узнать, что человек нажал «Принимаю» в соседней. `localStorage`
 * для этого и подходит: он общий для вкладок одного сайта, а событие
 * `storage` прилетает именно в ДРУГИЕ вкладки — ровно то поведение,
 * которое нужно.
 *
 * Хранится ВЕРСИЯ текста, а не просто «да». Пункт 7 самого Согласия требует
 * фиксировать редакцию, с которой человек согласился, — и если текст
 * поменяют, старое согласие перестанет засчитываться само.
 *
 * Пароль и телефон здесь не хранятся никогда: только версия документа.
 */
export const CONSENT_KEY = 'ecash:consent';

/** Согласие принято именно с текущей редакцией текста. */
export function readConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === CONSENT_VERSION;
  } catch {
    // приватный режим или заблокированное хранилище — просто нет согласия
    return false;
  }
}

/** Записать принятие текущей редакции. */
export function writeConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
  } catch {
    // не записалось — человек просто поставит галочку руками
  }
  // `storage` прилетает только в ДРУГИЕ вкладки; свою уведомляем сами,
  // чтобы кнопка на этой же странице сразу переключилась в «принято»
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Своё событие для той же вкладки — пара к браузерному `storage`. */
const CONSENT_EVENT = 'ecash:consent-changed';

/**
 * Подписка для `useSyncExternalStore`: React сам перечитает согласие, когда
 * оно изменится — в этой вкладке (своё событие) или в соседней (`storage`).
 * Это правильный способ читать внешнее хранилище: он не спорит с гидратацией
 * и не требует setState в эффекте.
 */
export function subscribeConsent(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CONSENT_EVENT, onChange);
  };
}

/** Снимок для сервера: там хранилища нет, согласия тоже. */
export const consentServerSnapshot = () => false;
