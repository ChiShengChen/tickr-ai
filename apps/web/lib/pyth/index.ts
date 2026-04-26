// Server-side Pyth helper for the web app. Mirrors ws-server's getLatestPrices
// but kept self-contained so the web app doesn't depend on ws-server modules.

import {
  PYTH_HERMES_DEFAULT_URL,
  XSTOCKS,
  bareToXStock,
  type BareTicker,
  type XStockTicker,
} from '@hunch-it/shared';

interface ParsedPrice {
  id: string;
  price?: { price: string | number; expo: number; publish_time: number };
}

const HERMES = process.env.PYTH_HERMES_URL ?? PYTH_HERMES_DEFAULT_URL;

function decode(price: string | number, expo: number): number {
  const raw = typeof price === 'string' ? Number(price) : price;
  return raw * 10 ** expo;
}

/**
 * Fetches the latest spot price for each xStock ticker (bare or xStock symbol)
 * via Hermes REST. Returns prices keyed by xStock symbol (e.g. "AAPLx").
 * Throws if any feed id is empty (constants not yet populated).
 */
export async function getCurrentPrices(
  tickers: readonly (BareTicker | XStockTicker)[],
): Promise<Map<XStockTicker, number>> {
  const ids: string[] = [];
  const idToXStock = new Map<string, XStockTicker>();
  for (const t of tickers) {
    const bare = (t.endsWith('x') ? t.slice(0, -1) : t) as BareTicker;
    const meta = XSTOCKS[bare];
    if (!meta || !meta.pythFeedId) continue;
    ids.push(meta.pythFeedId);
    idToXStock.set(
      meta.pythFeedId.startsWith('0x') ? meta.pythFeedId : `0x${meta.pythFeedId}`,
      bareToXStock(bare),
    );
  }
  if (ids.length === 0) return new Map();

  const params = ids.map((id) => `ids[]=${encodeURIComponent(id)}`).join('&');
  const url = `${HERMES}/v2/updates/price/latest?${params}`;
  const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Hermes failed: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { parsed?: ParsedPrice[] };

  const out = new Map<XStockTicker, number>();
  for (const p of json.parsed ?? []) {
    const id = p.id.startsWith('0x') ? p.id : `0x${p.id}`;
    const xst = idToXStock.get(id);
    if (!xst || !p.price) continue;
    out.set(xst, decode(p.price.price, p.price.expo));
  }
  return out;
}
