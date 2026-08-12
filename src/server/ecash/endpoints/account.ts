import 'server-only';
import type { Account } from '@/lib/domain';
import { ecashFetch } from '../http';
import { mapAccount } from '@/shared/ecash/mappers';

/** Методы в контексте пользователя — только с пользовательским токеном. */

export async function accountMe(accessToken: string): Promise<Account> {
  const raw = await ecashFetch<unknown>('/mobile/account/me', { token: accessToken });
  return mapAccount(raw as Parameters<typeof mapAccount>[0]);
}

export const updateClient = (
  accessToken: string,
  patch: { phoneNumber?: string; email?: string },
) =>
  ecashFetch<unknown>('/mobile/account/update-client', {
    method: 'PUT',
    token: accessToken,
    body: patch,
  });

