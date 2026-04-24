import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { TradeStatusSchema } from '@signaldesk/shared';
import { prisma } from '@/lib/db';

const TradeInputSchema = z.object({
  walletAddress: z.string().min(32),
  signalId: z.string().nullable().optional(),
  ticker: z.string(),
  side: z.enum(['BUY', 'SELL']),
  amountUsd: z.number().nonnegative(),
  tokenAmount: z.number().nonnegative(),
  executionPrice: z.number().nonnegative(),
  txSignature: z.string().min(1),
  status: TradeStatusSchema,
});

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = TradeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid payload', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const t = parsed.data;

  const user = await prisma.user.upsert({
    where: { walletAddress: t.walletAddress },
    update: {},
    create: { walletAddress: t.walletAddress },
  });

  // Compute realizedPnl for SELL using the *current* avgCost from Position.
  // BUY trades have realizedPnl = 0 (cost basis only updates).
  let realizedPnl = 0;
  if (t.side === 'SELL' && t.status === 'CONFIRMED') {
    const existing = await prisma.position.findUnique({
      where: { userId_ticker: { userId: user.id, ticker: t.ticker } },
    });
    if (existing) {
      realizedPnl = (t.executionPrice - existing.avgCost) * Math.min(t.tokenAmount, existing.tokenAmount);
    }
  }

  const trade = await prisma.trade.create({
    data: {
      userId: user.id,
      signalId: t.signalId ?? null,
      ticker: t.ticker,
      side: t.side,
      amountUsd: t.amountUsd,
      tokenAmount: t.tokenAmount,
      executionPrice: t.executionPrice,
      txSignature: t.txSignature,
      status: t.status,
      realizedPnl,
    },
  });

  if (t.status === 'CONFIRMED') {
    await updatePosition(user.id, t);
  }

  return NextResponse.json({ ok: true, trade });
}

async function updatePosition(
  userId: string,
  t: z.infer<typeof TradeInputSchema>,
): Promise<void> {
  const where = { userId_ticker: { userId, ticker: t.ticker } };
  const existing = await prisma.position.findUnique({ where });

  if (t.side === 'BUY') {
    if (!existing) {
      await prisma.position.create({
        data: {
          userId,
          ticker: t.ticker,
          tokenAmount: t.tokenAmount,
          avgCost: t.executionPrice,
        },
      });
      return;
    }
    const newQty = existing.tokenAmount + t.tokenAmount;
    const newAvgCost =
      newQty > 0
        ? (existing.tokenAmount * existing.avgCost + t.tokenAmount * t.executionPrice) / newQty
        : t.executionPrice;
    await prisma.position.update({
      where,
      data: { tokenAmount: newQty, avgCost: newAvgCost },
    });
    return;
  }

  // SELL
  if (!existing) return; // selling without a tracked position — skip silently
  const newQty = existing.tokenAmount - t.tokenAmount;
  if (newQty <= 1e-6) {
    await prisma.position.delete({ where });
  } else {
    // avgCost is unchanged on partial sell.
    await prisma.position.update({ where, data: { tokenAmount: newQty } });
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ trades: [] });
  const user = await prisma.user.findUnique({ where: { walletAddress: wallet } });
  if (!user) return NextResponse.json({ trades: [] });
  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ trades });
}
