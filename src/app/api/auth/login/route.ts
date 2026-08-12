import { NextResponse } from 'next/server';
import { login } from '@/server/ecash/endpoints/auth';
import { accountMe } from '@/server/ecash/endpoints/account';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createSession, sessionFromTokens } from '@/server/session';
import { loginBody } from '@/shared/schemas';

/** Вход: телефон или ИИН + пароль. Единственный путь — через ядро Ecash. */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'login', 10, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, loginBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const tokens = await login(parsed.login, parsed.password);
    const account = await accountMe(tokens.accessToken);
    await createSession(sessionFromTokens(tokens, account.accountId, account.phoneNumber));
    return ok({ account });
  } catch (e) {
    return fromError(e);
  }
}
