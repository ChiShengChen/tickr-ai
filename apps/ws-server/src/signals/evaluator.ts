import type { PrismaClient } from '@prisma/client';
import { type XStockTicker, xStockToBare } from '@hunch-it/shared';
import { getBarsRange } from '../pyth/benchmarks.js';

const HORIZON_SECONDS = 60 * 60; // 1 hour
const NEUTRAL_BAND = 0.001; // ±0.1% — anything tighter than this is noise.
const BATCH = 50;
const RPC_DELAY_MS = 150;

export type SignalOutcome = 'WIN' | 'LOSS' | 'NEUTRAL';

export interface EvaluationSummary {
  evaluated: number;
  skipped: number;
  errors: number;
}

function classify(action: 'BUY' | 'SELL' | 'HOLD', pctChange: number): SignalOutcome {
  if (action === 'HOLD') return 'NEUTRAL';
  if (Math.abs(pctChange) < NEUTRAL_BAND) return 'NEUTRAL';
  if (action === 'BUY') return pctChange > 0 ? 'WIN' : 'LOSS';
  // SELL
  return pctChange < 0 ? 'WIN' : 'LOSS';
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Walks `Signal` rows where `createdAt + 1h <= now` and `evaluatedAt IS NULL`.
 * For each, fetches the 5-min Pyth Benchmarks bar covering `createdAt + 1h`,
 * computes `pctChange` against `priceAtSignal`, and writes
 * `priceAfter / pctChange / outcome / evaluatedAt`.
 *
 * If the target bar isn't available yet (Pyth lag, holiday/weekend) the row is
 * left untouched so the next cron tick retries.
 */
export async function evaluatePendingSignals(prisma: PrismaClient): Promise<EvaluationSummary> {
  const summary: EvaluationSummary = { evaluated: 0, skipped: 0, errors: 0 };
  const horizonAgo = new Date(Date.now() - HORIZON_SECONDS * 1000);

  const pending = await prisma.signal.findMany({
    where: { createdAt: { lte: horizonAgo }, evaluatedAt: null },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  });

  for (const sig of pending) {
    try {
      // Tickers are stored as xStock symbols ("AAPLx") in the DB; Pyth is bare.
      const bare = xStockToBare(sig.ticker as XStockTicker);
      const targetUnix = Math.floor(sig.createdAt.getTime() / 1000) + HORIZON_SECONDS;
      // Pull a small window around the target so we always get the covering bar.
      const bars = await getBarsRange(bare, '5', targetUnix - 600, targetUnix + 900);
      const cover = [...bars].reverse().find((b) => b.time <= targetUnix);
      if (!cover) {
        summary.skipped++;
        continue;
      }
      const priceAfter = cover.close;
      const pctChange =
        sig.priceAtSignal > 0 ? (priceAfter - sig.priceAtSignal) / sig.priceAtSignal : 0;
      const outcome = classify(sig.action, pctChange);

      await prisma.signal.update({
        where: { id: sig.id },
        data: {
          priceAfter,
          pctChange,
          outcome,
          evaluatedAt: new Date(),
        },
      });
      summary.evaluated++;
    } catch (err) {
      console.warn(`[eval] ${sig.id} (${sig.ticker}) failed`, err);
      summary.errors++;
    }
    await sleep(RPC_DELAY_MS);
  }

  return summary;
}
