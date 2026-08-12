import 'server-only';
import { env } from '@/server/env';
import { getServiceToken } from '@/server/ecash/service-token';
import { EcashError } from '@/server/ecash/errors';

/**
 * Проверка связи с Ecash при старте — и громкий, однозначный вывод в лог.
 *
 * Зачем. Валидация окружения проверяет только ФОРМУ переменных: что они
 * заданы и похожи на правду. Верна ли пара ECASH_CLIENT_ID/SECRET и отвечает
 * ли указанный контур — до первого запроса пользователя не знал никто.
 * При переезде на боевой API это главный риск: сервер поднимается штатно,
 * healthcheck зелёный, а сайт молча остаётся без курсов и отделений, и
 * причина видна только в ошибках отдельных запросов.
 *
 * Процесс НЕ роняем: без Ecash остаются рабочими лендинг, новости, франшиза
 * и раздел документов, а недоступность апстрима бывает временной. Задача
 * проверки — сказать правду в лог сразу, а не через час поддержки.
 */

type EcashStatus = 'ok' | 'bad-credentials' | 'unreachable' | 'unknown';

const g = globalThis as unknown as { __ecashStartup?: EcashStatus };

/** Результат последней проверки — отдаётся в /api/health. */
export const ecashStartupStatus = (): EcashStatus => g.__ecashStartup ?? 'unknown';

export async function checkEcashConnection(): Promise<void> {
  const where = `${env.ECASH_API_BASE_URL} (clientId: ${env.ECASH_CLIENT_ID})`;
  try {
    await getServiceToken();
    g.__ecashStartup = 'ok';
    console.warn(`[startup] Ecash: ключи приняты, сервисный токен получен — ${where}`);
  } catch (e) {
    const code = e instanceof EcashError ? e.code : 'UNKNOWN';
    const badKeys = code === 'INVALID_CLIENT_CREDENTIALS' || code === 'INVALID_TOKEN';
    g.__ecashStartup = badKeys
      ? 'bad-credentials'
      : code.startsWith('UPSTREAM_')
        ? 'unreachable'
        : 'unknown';

    console.error(
      [
        '',
        '='.repeat(72),
        `[startup] ВНИМАНИЕ: Ecash не отвечает или не принял ключи (${code}).`,
        `          Адрес: ${where}`,
        '',
        badKeys
          ? '          Пара ECASH_CLIENT_ID / ECASH_CLIENT_SECRET отвергнута.'
          : '          Контур недоступен — проверьте ECASH_API_BASE_URL и сеть.',
        '',
        '          НЕ БУДУТ РАБОТАТЬ: курсы, отделения, вход, регистрация,',
        '          бронирование, индивидуальный курс, заявки на франшизу.',
        '          Останутся рабочими: лендинг, новости, документы.',
        '='.repeat(72),
        '',
      ].join('\n'),
    );
  }
}
