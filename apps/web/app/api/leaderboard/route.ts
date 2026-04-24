import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

interface LeaderEntry {
  walletAddress: string;
  realizedPnl: number;
  trades: number;
  approvalsYes: number;
  approvalsNo: number;
  approvalAccuracy: number | null;
}

/**
 * Top users ranked by realized P&L. Approval accuracy is the share of their
 * "Yes" decisions where the matching trade was profitable. We approximate:
 *   - For each Yes approval that has a corresponding Trade row in CONFIRMED state,
 *     count it as correct iff that trade's realizedPnl > 0 (SELL) OR a later
 *     SELL on the same ticker realised positive P&L.
 *   - For Yes approvals without a matching trade, ignore (excluded from accuracy).
 *
 * For hackathon scope we keep it tractable: accuracy = (#confirmed SELL trades
 * for the user with realizedPnl > 0) / (#confirmed SELL trades for the user).
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '20'), 100);

  const users = await prisma.user.findMany({
    include: {
      trades: { where: { status: 'CONFIRMED' } },
      approvals: true,
    },
  });

  const board: LeaderEntry[] = users.map((u) => {
    const sells = u.trades.filter((t) => t.side === 'SELL');
    const realizedPnl = sells.reduce((acc, t) => acc + t.realizedPnl, 0);
    const winningSells = sells.filter((t) => t.realizedPnl > 0).length;
    const approvalsYes = u.approvals.filter((a) => a.decision).length;
    const approvalsNo = u.approvals.filter((a) => !a.decision).length;
    const accuracy = sells.length > 0 ? winningSells / sells.length : null;
    return {
      walletAddress: u.walletAddress,
      realizedPnl,
      trades: u.trades.length,
      approvalsYes,
      approvalsNo,
      approvalAccuracy: accuracy,
    };
  });

  board.sort((a, b) => b.realizedPnl - a.realizedPnl);
  return NextResponse.json({ board: board.slice(0, limit) });
}
