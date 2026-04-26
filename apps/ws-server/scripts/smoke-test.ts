/**
 * End-to-end sanity check before deploying.
 *
 *   pnpm --filter @hunch-it/ws-server smoke
 *
 * Steps:
 *   1. getLatestPrices(all) → print
 *   2. getHistoricalBars('AAPL', '5', 24) → print first/last bar
 *   3. computeIndicators(barsAAPL) → print
 *   4. generateLlmSignal(...AAPL) → print response + token usage
 */

import { BARE_TICKERS } from '@hunch-it/shared';
import { getHistoricalBars } from '../src/pyth/benchmarks.js';
import { evaluateFreshness, getLatestPrices } from '../src/pyth/index.js';
import { computeIndicators } from '../src/signals/indicators.js';
import { generateLlmSignal } from '../src/signals/llm.js';

async function main() {
  console.log('--- 1. Pyth latest prices ---');
  const prices = await getLatestPrices(BARE_TICKERS);
  for (const t of BARE_TICKERS) {
    const snap = prices.get(t);
    if (!snap) {
      console.log(`  ${t.padEnd(6)} (no snapshot)`);
      continue;
    }
    const v = evaluateFreshness(snap);
    console.log(
      `  ${t.padEnd(6)} $${snap.price.toFixed(2)}  conf±${snap.confidence.toFixed(4)}  ` +
        `age=${v.ageSeconds}s  market=${v.marketOpen ? 'OPEN' : 'CLOSED'}`,
    );
  }

  console.log('\n--- 2. AAPL historical bars (5min, 24h) ---');
  const bars = await getHistoricalBars('AAPL', '5', 24);
  console.log(`  total bars: ${bars.length}`);
  if (bars.length > 0) {
    const first = bars[0]!;
    const last = bars[bars.length - 1]!;
    console.log(
      `  first: ${new Date(first.time * 1000).toISOString()}  O:${first.open} H:${first.high} L:${first.low} C:${first.close}`,
    );
    console.log(
      `  last:  ${new Date(last.time * 1000).toISOString()}  O:${last.open} H:${last.high} L:${last.low} C:${last.close}`,
    );
  }

  console.log('\n--- 3. AAPL indicators ---');
  const ind = await computeIndicators(bars);
  console.log(`  RSI(14): ${ind.rsi14.toFixed(2)}`);
  console.log(
    `  MACD:    macd=${ind.macd.macd.toFixed(4)}  signal=${ind.macd.signal.toFixed(4)}  hist=${ind.macd.histogram.toFixed(4)}`,
  );
  console.log(`  MA20:    ${ind.ma20.toFixed(2)}`);
  console.log(`  MA50:    ${ind.ma50.toFixed(2)}`);

  console.log('\n--- 4. LLM signal (AAPL) ---');
  const aaplSnap = prices.get('AAPL');
  if (!aaplSnap) {
    console.error('AAPL has no Pyth snapshot, skipping LLM step');
    process.exit(1);
  }
  const result = await generateLlmSignal({
    ticker: 'AAPL',
    currentPrice: aaplSnap.price,
    bars,
    indicators: ind,
  });
  console.log(`  action:     ${result.signal.action}`);
  console.log(`  confidence: ${result.signal.confidence.toFixed(2)}`);
  console.log(`  rationale:  ${result.signal.rationale}`);
  console.log(`  ttl:        ${result.signal.ttl_seconds}s`);
  console.log(`  degraded:   ${result.degraded}`);
  if (result.inputTokens != null) {
    console.log(
      `  tokens:     in=${result.inputTokens}  out=${result.outputTokens}  cost=$${(result.costUsd ?? 0).toFixed(4)}`,
    );
  }

  console.log('\n✅ smoke test ok');
}

main().catch((err) => {
  console.error('\n❌ smoke test failed', err);
  process.exit(1);
});
