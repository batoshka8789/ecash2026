import 'server-only';
import type { Department, DepartmentInfo } from '@/lib/domain';
import { ecashFetch } from '../http';
import { mapDepartment, mapDepartmentInfo } from '../mappers';
import { getServiceToken, invalidateServiceToken } from '../service-token';
import { EcashError } from '../errors';

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

export async function depList(): Promise<Department[]> {
  const raw = await serviceGet<unknown[]>('/Department/depListApp');
  return (
    (raw ?? [])
      .map((d) => mapDepartment(d as Parameters<typeof mapDepartment>[0]))
      // dev-среда содержит тестовые записи без адреса — наружу их не отдаём
      .filter((d) => d.depId > 0 && d.address.trim().length > 0)
  );
}

export async function depInfo(depId: number): Promise<DepartmentInfo> {
  const raw = await serviceGet<unknown>(`/Department/depInfo/${depId}`);
  return mapDepartmentInfo(raw as Parameters<typeof mapDepartmentInfo>[0]);
}
