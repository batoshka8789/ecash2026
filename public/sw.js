/**
 * Служебный воркер — только для push-уведомлений.
 *
 * Намеренно НЕ кеширует страницы и не перехватывает запросы: офлайн-режим
 * нам не нужен, а самодельный кеш в приложении с живыми курсами валют — это
 * прямой путь показать вчерашний курс как сегодняшний. Воркер живёт ровно
 * ради двух событий ниже.
 *
 * Пишется вручную, а не собирается плагином: файл целиком помещается на
 * экран, и тащить ради него сборочный слой не за что.
 */

/** Новый воркер вступает в силу сразу, не дожидаясь закрытия всех вкладок. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  // Без данных — показываем нейтральное сообщение: молча проглотить нельзя,
  // браузеры наказывают за push без видимого уведомления вплоть до отзыва
  // разрешения.
  let payload = { title: 'ecash', body: '', url: '/notifications', tag: 'ecash' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    /* повреждённая нагрузка — покажем нейтральное */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/img/notify-icon.png',
      badge: '/img/notify-badge.png',
      tag: payload.tag,
      // с той же меткой — заменяем прежнее уведомление, но сообщаем об этом:
      // иначе замена происходит совсем беззвучно и человек её пропускает
      renotify: true,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/notifications';

  // Если вкладка сайта уже открыта — переиспользуем её, а не плодим новые.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
