import 'server-only';
import type { Department, DepartmentInfo } from '@/lib/domain';
import { env } from '@/server/env';
import { ecashFetch } from '../http';
import { cachedUpstream } from '../cache';
import { mapDepartment, mapDepartmentInfo } from '@/shared/ecash/mappers';
import { getServiceToken, invalidateServiceToken } from '../service-token';
import { EcashError } from '../errors';

/** Список и карточки отделений меняются редко — 5 минут, как staleTime клиента. */
const DEP_TTL_MS = 5 * 60_000;

/** GET c сервисным токеном + один повтор после re-issue при 401. */
export async function serviceGet<T>(path: string): Promise<T> {
  const token = await getServiceToken();
  try {
    return await ecashFetch<T>(path, { token });
  } catch (e) {
    if (e instanceof EcashError && e.httpStatus === 401) {
      invalidateServiceToken();
      const fresh = await getServiceToken();
      return ecashFetch<T>(path, { token: fresh });
    }
    throw e;
  }
}

export function depList(): Promise<Department[]> {
  return cachedUpstream('depList', DEP_TTL_MS, async () => {
    const raw = await serviceGet<unknown[]>('/Department/depListApp');
    return (
      (raw ?? [])
        .map((d) => mapDepartment(d as Parameters<typeof mapDepartment>[0]))
        // Записи без адреса — заведомо служебные («ТестТест», «Тест»):
        // человеку некуда прийти, а на карте их нечем разместить.
        .filter((d) => d.depId > 0 && d.address.trim().length > 0)
        // Остальные служебные записи дев-контура («DEVTEST», «проверка
        // лимитов») по данным неотличимы от настоящих — у них есть и адрес,
        // и курсы. Поэтому их список задаётся явно: HIDDEN_DEP_IDS.
        .filter((d) => !env.HIDDEN_DEP_IDS.includes(d.depId))
    );
  });
}

/**
 * Отделение видно посетителю? Единственный источник правды — отфильтрованный
 * `depList()`.
 *
 * Раньше фильтр стоял только в списке, и служебные отделения дев-контура
 * оставались доступны в обход него: `/api/departments/40` отдавал DEVTEST,
 * `/api/rates?depId=34` — курсы «проверки лимитов», а ссылка вида
 * `/booking?depId=40` открывала бронь на отделение с адресом «test». Список
 * при этом был чистым, поэтому со стороны выглядело, будто всё в порядке.
 *
 * Ответ на скрытое отделение намеренно такой же, как на несуществующее:
 * подтверждать, что id занят, незачем.
 */
export async function assertVisibleDep(depId: number): Promise<void> {
  const deps = await depList();
  if (!deps.some((d) => d.depId === depId)) {
    throw new EcashError('DEPARTMENT_NOT_FOUND', 404, `Department ${depId} is not available`);
  }
}

export async function depInfo(depId: number): Promise<DepartmentInfo> {
  await assertVisibleDep(depId);
  return cachedUpstream(`depInfo:${depId}`, DEP_TTL_MS, async () => {
    const raw = await serviceGet<unknown>(`/Department/depInfo/${depId}`);
    return mapDepartmentInfo(raw as Parameters<typeof mapDepartmentInfo>[0]);
  });
}
