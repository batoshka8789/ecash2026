'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Push-уведомления в браузере: состояние разрешения, подписка и отписка.
 *
 * Вся возня с Web Push API собрана здесь, чтобы компоненты работали с одним
 * понятным состоянием, а не с четырьмя разными источниками правды
 * (`Notification.permission`, регистрация воркера, объект подписки, наш сервер).
 */

export type PushState =
  /** пока считаем, что поддерживается — до первой проверки */
  | 'loading'
  /** браузер не умеет push (Safari без установки на экран «Домой», старые версии) */
  | 'unsupported'
  /** сервер без ключей VAPID — раздел просто не показываем */
  | 'disabled'
  /** можно подключить */
  | 'idle'
  /** подписан */
  | 'on'
  /** пользователь запретил в настройках браузера — включить из кода нельзя */
  | 'denied';

/**
 * base64url из VAPID → байты, которых требует pushManager.
 *
 * Буфер создаётся явно, а не берётся у Uint8Array: тип `ArrayBufferLike`
 * из lib.dom не совпадает с ожидаемым `BufferSource`, и без этого не
 * проходит проверка типов.
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

const supported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export function usePush() {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!supported()) {
        if (alive) setState('unsupported');
        return;
      }
      try {
        const { enabled } = await api.push.publicKey();
        if (!alive) return;
        if (!enabled) {
          setState('disabled');
          return;
        }
        if (Notification.permission === 'denied') {
          setState('denied');
          return;
        }
        // Уже подписаны? Спрашиваем сам браузер, а не своё хранилище:
        // разрешение могли отозвать в настройках, и localStorage об этом
        // никогда не узнает.
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (!alive) return;
        setState(sub ? 'on' : 'idle');
      } catch {
        if (alive) setState('unsupported');
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { enabled, key } = await api.push.publicKey();
      if (!enabled || !key) {
        setState('disabled');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'idle');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      // без ready подписка на только что зарегистрированном воркере падает:
      // он ещё не активен
      await navigator.serviceWorker.ready;

      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          // false здесь запрещён всеми браузерами: молчаливый push не
          // разрешается никому, кроме отдельных корпоративных случаев
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(key),
        }));

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      if (!json.endpoint || !json.keys) throw new Error('bad subscription');

      await api.push.subscribe({ endpoint: json.endpoint, keys: json.keys });
      setState('on');
    } catch {
      setError('failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // сначала сервер, потом браузер: если убрать локально и упасть на
        // сети, сервер продолжит слать на мёртвый адрес
        await api.push.unsubscribe(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setState('idle');
    } catch {
      setError('failed');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable };
}
