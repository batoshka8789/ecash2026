import { db, newId } from '@/server/db';
import { body, fail, isPhone, ok } from '@/server/http';
import type { FranchiseLead } from '@/lib/types';

/** Заявка с лендинга франшизы. */
export async function POST(req: Request) {
  const data = await body<{ name?: string; phone?: string; city?: string }>(req);
  const name = data?.name?.trim() ?? '';
  const phone = data?.phone?.trim() ?? '';

  if (!name) return fail('errors.nameRequired', 400, 'name');
  if (!isPhone(phone)) return fail('errors.phoneRequired', 400, 'phone');

  const lead: FranchiseLead = {
    id: newId(),
    name,
    phone,
    city: data?.city?.trim() ?? '',
    createdAt: Date.now(),
  };
  db.leads.unshift(lead);

  return ok({ lead }, { status: 201 });
}
