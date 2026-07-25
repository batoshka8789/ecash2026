import { depList } from '@/server/ecash/endpoints/departments';
import { fromError, ok } from '@/server/api/respond';

export async function GET() {
  try {
    return ok({ departments: await depList() });
  } catch (e) {
    return fromError(e);
  }
}
