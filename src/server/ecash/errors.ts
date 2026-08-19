import 'server-only';

/**
 * Единая ошибка вышестоящего API. Upstream отвечает в двух несовместимых
 * формах (проверено живыми запросами):
 *   1) доменная:       { success:false, code:409, error:"OTP_COOLDOWN", message:"...", data? }
 *   2) ProblemDetails: { errors:{ Login:["..."] }, status:400, title:"...", traceId:"..." }
 * плюс «голые» 401 (WWW-Authenticate: Bearer) и 403 с пустым телом.
 */
export class EcashError extends Error {
  constructor(
    /** машинный код: OTP_COOLDOWN, INVALID_TOKEN, … — становится ключом i18n errors.<code> */
    readonly code: string,
    readonly httpStatus: number,
    message: string,
    /** имена невалидных полей из ProblemDetails (нормализованы в camelCase) */
    readonly fields?: string[],
    /** полезная нагрузка доменной ошибки — напр. существующая заявка при REQUEST_ALREADY_EXISTS */
    readonly data?: unknown,
    readonly traceId?: string,
    /**
     * Человеческий текст ошибки ОТ САМОГО ЯДРА (поле message доменной
     * формы, по-русски). Заполняется только для доменных ошибок — не для
     * наших синтетических (таймаут, пустые 401/403). Интерфейс показывает
     * его, когда код не найден в словаре: у ядра плодятся
     * недокументированные коды (AMOUNT_MISMATCH, REQUEST_NOT_CREATED…),
     * и до добавления перевода человек видел «Что-то пошло не так» вместо
     * внятной причины, которая уже лежала в ответе.
     */
    readonly upstreamMessage?: string,
  ) {
    super(message);
    this.name = 'EcashError';
  }
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** Разбирает любой неуспешный ответ upstream в EcashError. */
export function normalizeError(status: number, body: unknown): EcashError {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;

    // форма 1: доменная
    if (typeof b.error === 'string' && b.error.length > 0) {
      const human =
        typeof b.message === 'string' && b.message.trim() && b.message !== b.error
          ? b.message
          : undefined;
      return new EcashError(
        b.error,
        status,
        human ?? b.error,
        undefined,
        b.data,
        undefined,
        human,
      );
    }

    // форма 2: ASP.NET ProblemDetails (валидация модели)
    if (b.errors && typeof b.errors === 'object') {
      const fields = Object.keys(b.errors as object).map(lowerFirst);
      const firstMsgs = Object.values(b.errors as Record<string, string[]>)
        .flat()
        .slice(0, 3)
        .join('; ');
      return new EcashError(
        'VALIDATION',
        status,
        firstMsgs || 'Validation failed',
        fields,
        undefined,
        typeof b.traceId === 'string' ? b.traceId : undefined,
      );
    }
  }

  // пустые тела: 401/403 от auth-мидлвари, 5xx от nginx
  if (status === 401) return new EcashError('INVALID_TOKEN', 401, 'Unauthorized');
  if (status === 403) return new EcashError('FORBIDDEN', 403, 'Forbidden');
  if (status === 404) return new EcashError('NOT_FOUND', 404, 'Not found');
  if (status >= 500) return new EcashError('UPSTREAM_UNAVAILABLE', status, `Upstream ${status}`);
  return new EcashError('UNKNOWN', status, `Unexpected upstream response ${status}`);
}

/** Ошибки сети/таймаута — до получения HTTP-статуса. */
export function networkError(cause: unknown): EcashError {
  const isTimeout =
    cause instanceof DOMException ? cause.name === 'TimeoutError' || cause.name === 'AbortError' : false;
  return new EcashError(
    isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE',
    504,
    isTimeout ? 'Upstream timeout' : 'Upstream unreachable',
  );
}
