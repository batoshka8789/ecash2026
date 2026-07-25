import { bestRate } from '@/server/ecash/endpoints/rates';
import { fail, fromError, ok } from '@/server/api/respond';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const currency = url.searchParams.get('currency');
  const city = url.searchParams.get('city') ?? undefined;
  if (!currency) return fail('errors.CURRENCY_REQUIRED');
  try {
    return ok({ best: await bestRate(currency.toUpperCase(), city) });
  } catch (e) {
    return fromError(e);
  }
}
