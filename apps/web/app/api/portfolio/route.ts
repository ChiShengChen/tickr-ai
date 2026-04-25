import { NextResponse, type NextRequest } from 'next/server';
import {
  demoInitialPositions,
  demoInitialTrades,
  type XStockTicker,
} from '@signaldesk/shared';
import { prisma } from '@/lib/db';
import { isDemoServer } from '@/lib/demo/flag';
import { getCurrentPrices } from '@/lib/pyth';

export async function GET(req: NextRequest) {
  if (isDemoServer()) {
    const positions = demoInitialPositions();
    const trades = demoInitialTrades();
    const realized = trades
      .filter((t) => t.side === 'SELL' && t.status === 'CONFIRMED')
      .reduce((acc, t) => acc + t.realizedPnl, 0);
    const unrealized = positions.reduce((acc, p) => acc + (p.pnl ?? 0), 0);
    return NextResponse.json({ positions, trades, pnl: { realized, unrealized } });
  }

  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({
      positions: [],
      trades: [],
      pnl: { realized: 0, unrealized: 0 },
    });
  }

  const user = await prisma.user.findUnique({ where: { walletAddress: wallet } });
  if (!user) {
    return NextResponse.json({
      positions: [],
      trades: [],
      pnl: { realized: 0, unrealized: 0 },
    });
  }

  const [positions, trades] = await Promise.all([
    prisma.position.findMany({ where: { userId: user.id } }),
    prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  // Realized P&L = sum of `realizedPnl` on confirmed SELL trades.
  const realized = trades
    .filter((t) => t.status === 'CONFIRMED' && t.side === 'SELL')
    .reduce((acc, t) => acc + t.realizedPnl, 0);

  // Unrealized P&L = sum over open positions of (markPrice - avgCost) * tokenAmount.
  // Tickers stored on Position are xStock symbols (e.g. "AAPLx").
  let unrealized = 0;
  const enriched: Array<(typeof positions)[number] & { markPrice?: number; pnl?: number }> = [];
  if (positions.length > 0) {
    let prices: Map<XStockTicker, number> = new Map();
    try {
      prices = await getCurrentPrices(positions.map((p) => p.ticker as XStockTicker));
    } catch (err) {
      console.warn('[portfolio] getCurrentPrices failed', err);
    }
    for (const p of positions) {
      const mark = prices.get(p.ticker as XStockTicker);
      if (mark != null) {
        const pnl = (mark - p.avgCost) * p.tokenAmount;
        unrealized += pnl;
        enriched.push({ ...p, markPrice: mark, pnl });
      } else {
        enriched.push({ ...p });
      }
    }
  }

  return NextResponse.json({
    positions: enriched,
    trades,
    pnl: { realized, unrealized },
  });
}
