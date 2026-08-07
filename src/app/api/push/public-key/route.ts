import { pushEnabled } from '@/server/push';
import { env } from '@/server/env';
import { ok } from '@/server/api/respond';

/**
 * Публичный ключ VAPID для подписки браузера. Публичный по определению —
 * без него `pushManager.subscribe()` работать не может.
 *
 * Отдельным маршрутом, а не переменной NEXT_PUBLIC_: так ключ не вшивается
 * в бандл при сборке, и его можно менять переменной окружения без пересборки
 * образа. `enabled: false` — способ для интерфейса понять, что push на этом
 * стенде не настроен, и не показывать карточку подписки вовсе.
 */
export async function GET() {
  return ok({ enabled: pushEnabled, key: pushEnabled ? env.VAPID_PUBLIC_KEY : null });
}
