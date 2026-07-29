import { getServiceToken, serviceTokenExpiresIn } from '@/server/ecash/service-token';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { fromError, ok } from '@/server/api/respond';

/**
 * Выдаёт браузеру СЕРВИСНЫЙ access-токен, но не пару clientId/clientSecret.
 *
 * Зачем: CORS Ecash пускает наш origin (`http://localhost:3000` в деве,
 * `https://ecash.kz` в проде), поэтому публичные справочники — отделения и
 * курсы — браузер тянет с api-dev.quiq.kz напрямую, без прокси через нас.
 * Но получить токен он может только по clientSecret, а секрет в JS
 * выкладывать нельзя: его прочитает любой из devtools и начнёт выпускать
 * токены от имени приложения. Поэтому пару держит сервер, наружу отдаётся
 * только сам токен — короткоживущий (час) и по редакции 3 открывающий
 * ровно публичные справочники, ничего пользовательского.
 *
 * Токен один на все браузеры и кэшируется на сервере (service-token.ts),
 * так что эта ручка почти всегда отвечает из памяти, без похода в Ecash.
 */
export async function GET(req: Request) {
  const bad = checkOrigin(req);
  if (bad) return bad;

  // защита от превращения ручки в бесплатный раздатчик токенов
  if (rateLimited(req, 'ecash-token', 60, 60_000)) {
    return Response.json({ error: 'errors.RATE_LIMITED', data: null }, { status: 429 });
  }

  try {
    const accessToken = await getServiceToken();
    return ok({ accessToken, expiresIn: serviceTokenExpiresIn() });
  } catch (e) {
    return fromError(e);
  }
}
