'use client';

import { create } from 'zustand';
import {
  demoInitialPositions,
  demoInitialTrades,
  makeDemoBars,
  type Bar,
  type DemoPortfolioPosition,
  type DemoPortfolioTrade,
} from '@hunch-it/shared';

export { isDemo, isDemoServer } from './flag';

interface DemoState {
  positions: DemoPortfolioPosition[];
  trades: DemoPortfolioTrade[];
  appendTrade: (t: Omit<DemoPortfolioTrade, 'id' | 'createdAt'>) => DemoPortfolioTrade;
}

function updatePositions(
  positions: DemoPortfolioPosition[],
  t: Omit<DemoPortfolioTrade, 'id' | 'createdAt'>,
): DemoPortfolioPosition[] {
  const idx = positions.findIndex((p) => p.ticker === t.ticker);
  if (t.side === 'BUY') {
    if (idx < 0) {
      return [
        ...positions,
        {
          ticker: t.ticker,
          tokenAmount: t.tokenAmount,
          avgCost: t.executionPrice,
          markPrice: t.executionPrice,
          pnl: 0,
        },
      ];
    }
    const cur = positions[idx]!;
    const newQty = cur.tokenAmount + t.tokenAmount;
    const newAvg =
      newQty > 0
        ? (cur.tokenAmount * cur.avgCost + t.tokenAmount * t.executionPrice) / newQty
        : t.executionPrice;
    const next = [...positions];
    next[idx] = { ...cur, tokenAmount: newQty, avgCost: newAvg };
    return next;
  }
  // SELL
  if (idx < 0) return positions;
  const cur = positions[idx]!;
  const newQty = cur.tokenAmount - t.tokenAmount;
  if (newQty <= 1e-6) {
    return positions.filter((_, i) => i !== idx);
  }
  const next = [...positions];
  next[idx] = { ...cur, tokenAmount: newQty };
  return next;
}

export const useDemoStore = create<DemoState>((set) => ({
  positions: demoInitialPositions(),
  trades: demoInitialTrades(),
  appendTrade: (t) => {
    const row: DemoPortfolioTrade = {
      ...t,
      id: `demo-trade-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      trades: [row, ...s.trades],
      positions: updatePositions(s.positions, t),
    }));
    return row;
  },
}));

export function getDemoBars(ticker: string, hoursBack = 24): Bar[] {
  return makeDemoBars(ticker, hoursBack);
}
