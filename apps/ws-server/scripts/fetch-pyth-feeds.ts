/**
 * Pulls the Pyth Hermes feed registry, filters for our 8 US equity tickers,
 * and writes the result to `data/pyth-feeds.json` plus a TS snippet to paste
 * into `packages/shared/src/constants.ts`.
 *
 * Run:
 *   pnpm --filter @hunch-it/ws-server fetch:pyth-feeds
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BARE_TICKERS, type BareTicker } from '@hunch-it/shared';
import { env } from '../src/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'data', 'pyth-feeds.json');

interface HermesFeed {
  id: string;
  attributes: Record<string, string | undefined> & {
    asset_type?: string;
    base?: string;
    quote_currency?: string;
    symbol?: string;
    description?: string;
    display_symbol?: string;
  };
}

async function main() {
  const url = `${env.PYTH_HERMES_URL}/v2/price_feeds?asset_type=equity`;
  console.log(`[pyth] fetching ${url}`);
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    console.error(`[pyth] fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const all = (await res.json()) as HermesFeed[];

  const wanted = new Set<BareTicker>(BARE_TICKERS);
  const matched = new Map<BareTicker, HermesFeed>();

  for (const feed of all) {
    const sym = feed.attributes.symbol ?? feed.attributes.display_symbol ?? '';
    // Pyth equity symbols look like "Equity.US.AAPL/USD".
    const m = sym.match(/^Equity\.US\.([A-Z]+)\/USD$/);
    if (!m) continue;
    const ticker = m[1] as BareTicker;
    if (!wanted.has(ticker)) continue;
    if (matched.has(ticker)) continue; // first wins
    matched.set(ticker, feed);
  }

  const result: Record<BareTicker, { id: string; symbol: string; description: string }> =
    {} as Record<BareTicker, { id: string; symbol: string; description: string }>;
  for (const ticker of BARE_TICKERS) {
    const feed = matched.get(ticker);
    if (!feed) {
      console.warn(`⚠ no feed found for ${ticker}`);
      continue;
    }
    const id = feed.id.startsWith('0x') ? feed.id : `0x${feed.id}`;
    result[ticker] = {
      id,
      symbol: feed.attributes.symbol ?? '',
      description: feed.attributes.description ?? '',
    };
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${Object.keys(result).length}/${BARE_TICKERS.length} feeds to ${OUTPUT_PATH}\n`);

  console.log('Paste into packages/shared/src/constants.ts (XSTOCKS):\n');
  for (const ticker of BARE_TICKERS) {
    const r = result[ticker];
    if (!r) continue;
    console.log(`  ${ticker}: { ...XSTOCKS.${ticker}, pythFeedId: '${r.id}' },  // ${r.symbol}`);
  }
}

main().catch((err) => {
  console.error('[pyth] failed', err);
  process.exit(1);
});
