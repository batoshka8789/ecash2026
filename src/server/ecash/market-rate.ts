import 'server-only';

/**
 * «Курс на бирже» — официальный курс Нацбанка РК (публичный RSS, без ключей).
 * У Ecash API такого эндпоинта нет; мок показывал константу 538.45.
 * Кэш 30 минут в globalThis.
 */

type MarketCache = { rates: Map<string, number>; fetchedAt: number };
const g = globalThis as unknown as { __ecashMarket?: MarketCache };

const TTL_MS = 30 * 60 * 1000;

async function fetchNbk(): Promise<Map<string, number>> {
  const res = await fetch('https://nationalbank.kz/rss/rates_all.xml', {
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`NBK ${res.status}`);
  const xml = await res.text();
  const rates = new Map<string, number>();

  /**
   * Разбираем каждый <item> целиком: между <title> и <description>
   * стоит <pubDate>, поэтому «склеенная» регулярка по соседним тегам
   * не работает. quant — номинал (напр. 100 JPY), приводим к единице.
   */
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const item of items) {
    const code = /<title>\s*([A-Z]{3})\s*<\/title>/.exec(item)?.[1];
    const value = /<description>\s*([\d.]+)\s*<\/description>/.exec(item)?.[1];
    if (!code || !value) continue;
    const quant = Number(/<quant>\s*(\d+)\s*<\/quant>/.exec(item)?.[1] ?? '1') || 1;
    const v = Number(value) / quant;
    if (Number.isFinite(v) && v > 0) rates.set(code, v);
  }

  if (rates.size === 0) throw new Error('NBK: пустой ответ');
  return rates;
}

/** Курс валюты к тенге по Нацбанку; null, если фид недоступен и кэша нет. */
export async function marketRate(code: string): Promise<number | null> {
  const now = Date.now();
  let c = g.__ecashMarket;
  if (!c || now - c.fetchedAt > TTL_MS) {
    try {
      c = { rates: await fetchNbk(), fetchedAt: now };
      g.__ecashMarket = c;
    } catch (e) {
      if (!c) {
        console.warn('[market-rate] NBK недоступен', e);
        return null;
      }
      // фид упал — работаем на устаревшем кэше
      c.fetchedAt = now - TTL_MS + 5 * 60 * 1000; // повтор через 5 минут
    }
  }
  return c.rates.get(code.toUpperCase()) ?? null;
}

/**
 * Вся карта курсов НБ РК разом.
 *
 * Нужна браузеру: курсы отделения он теперь берёт у Ecash напрямую, а «курс
 * на бирже» подписан в макете у каждой строки. Отдать одну карту дешевле,
 * чем спрашивать по валюте, и не завязывает наш эндпоинт на список валют
 * конкретного отделения. Фид nationalbank.kz оставляем на сервере: это XML
 * с чужого домена, тянуть его из браузера — ещё один origin в CSP и разбор
 * XML на клиенте.
 */
export async function allMarketRates(): Promise<Record<string, number>> {
  // прогреваем кэш тем же путём, что и точечный запрос
  await marketRate('USD');
  const c = g.__ecashMarket;
  if (!c) return {};
  return Object.fromEntries(c.rates);
}
