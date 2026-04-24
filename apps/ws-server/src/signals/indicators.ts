import type { Bar } from '@signaldesk/shared';

export interface MacdValue {
  macd: number;
  signal: number;
  histogram: number;
}

export interface IndicatorResult {
  rsi14: number;
  macd: MacdValue;
  ma20: number;
  ma50: number;
}

interface TiMacdRaw {
  MACD?: number;
  signal?: number;
  histogram?: number;
}

function last<T>(arr: T[] | undefined): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr[arr.length - 1];
}

export async function computeIndicators(bars: Bar[]): Promise<IndicatorResult> {
  const closes = bars.map((b) => b.close).filter((c) => Number.isFinite(c) && c > 0);
  const lastClose = closes[closes.length - 1] ?? 0;

  if (closes.length < 50) {
    return {
      rsi14: 50,
      macd: { macd: 0, signal: 0, histogram: 0 },
      ma20: lastClose,
      ma50: lastClose,
    };
  }

  const ti = (await import('technicalindicators')) as unknown as {
    RSI: { calculate: (i: { values: number[]; period: number }) => number[] };
    MACD: {
      calculate: (i: {
        values: number[];
        fastPeriod: number;
        slowPeriod: number;
        signalPeriod: number;
        SimpleMAOscillator: boolean;
        SimpleMASignal: boolean;
      }) => TiMacdRaw[];
    };
    SMA: { calculate: (i: { values: number[]; period: number }) => number[] };
  };

  const rsi = last(ti.RSI.calculate({ values: closes, period: 14 })) ?? 50;
  const macdRaw = last(
    ti.MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    }),
  );
  const ma20 = last(ti.SMA.calculate({ values: closes, period: 20 })) ?? lastClose;
  const ma50 = last(ti.SMA.calculate({ values: closes, period: 50 })) ?? lastClose;

  return {
    rsi14: rsi,
    macd: {
      macd: macdRaw?.MACD ?? 0,
      signal: macdRaw?.signal ?? 0,
      histogram: macdRaw?.histogram ?? 0,
    },
    ma20,
    ma50,
  };
}
