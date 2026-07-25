import { depInfo } from '@/server/ecash/endpoints/departments';
import { fail, fromError, ok } from '@/server/api/respond';

export async function GET(_req: Request, ctx: { params: Promise<{ depId: string }> }) {
  const { depId } = await ctx.params;
  const id = Number(depId);
  if (!Number.isInteger(id) || id <= 0) return fail('errors.DEPARTMENT_NOT_FOUND', 404);
  try {
    return ok({ department: await depInfo(id) });
  } catch (e) {
    return fromError(e);
  }
}
