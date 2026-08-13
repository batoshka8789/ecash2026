import { depInfo, depList } from '@/server/ecash/endpoints/departments';
import { fromError, ok } from '@/server/api/respond';

/**
 * Отделения. Без параметров — короткий список (id, адрес, код).
 *
 * `?details=1` — то же, но с карточками: координаты, расписание, курсы.
 *
 * Зачем второй режим. Координат и расписания в списке Ecash нет, они лежат
 * только в карточке отделения (`/Department/depInfo/{id}`). Разворот делался
 * на клиенте: список, а следом по запросу на каждое отделение — 16 запросов
 * браузер→сервер на КАЖДОЙ странице с картой или выбором отделения (главная,
 * /locations, /booking, профиль). Теперь разворачивает сервер: наружу один
 * ответ, а обращения к Ecash закрыты общим кешем `cachedUpstream` на 5 минут,
 * тем же, из которого отвечает `/api/departments/{id}`.
 *
 * Карточка, которая не открылась, пропускается: одно сбойное отделение не
 * должно ронять карту и список целиком.
 */
export async function GET(req: Request) {
  const details = new URL(req.url).searchParams.get('details') === '1';

  try {
    const deps = await depList();
    if (!details) return ok({ departments: deps });

    const settled = await Promise.allSettled(deps.map((d) => depInfo(d.depId)));
    return ok({
      departments: settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
    });
  } catch (e) {
    return fromError(e);
  }
}
