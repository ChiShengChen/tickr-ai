import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_LEADERBOARD } from '@hunch-it/shared';
import { prisma } from '@/lib/db';
import { isDemoServer } from '@/lib/demo/flag';

interface AgentStats {
  totalEvaluated: number;
  wins: number;
  losses: number;
  neutrals: number;
  winRate: number; // wins / (wins + losses); 0 if denom is 0
  avgPctMove: number; // average |pctChange| across all evaluated signals
}

interface LeaderEntry {
  walletAddress: string;
  realizedPnl: number;
  trades: number;
  approvalsYes: number;
  approvalsNo: number;
  approvalsCorrect: number;
  approvalsEvaluated: number;
  approvalAccuracy: number | null;
}

/**
 * Leaderboard:
 *   - Agent block: aggregate signal-outcome stats (driven by the 5-min back-evaluator).
 *   - User board: realised P&L from trades + signal-outcome-driven approval accuracy.
 *     Approval is "correct" iff (Yes + WIN) or (No + LOSS); NEUTRAL signals are
 *     excluded from the denominator.
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '20'), 100);
  if (isDemoServer()) {
    return NextResponse.json({
      agent: DEMO_LEADERBOARD.agent,
      board: DEMO_LEADERBOARD.board.slice(0, limit),
    });
  }

  const [users, evaluatedSignals] = await Promise.all([
    prisma.user.findMany({
      include: {
        trades: { where: { status: 'CONFIRMED' } },
        approvals: {
          include: {
            signal: {
              select: { id: true, outcome: true, evaluatedAt: true },
            },
          },
        },
      },
    }),
    prisma.signal.findMany({
      where: { outcome: { not: null } },
      select: { outcome: true, pctChange: true },
    }),
  ]);

  const wins = evaluatedSignals.filter((s) => s.outcome === 'WIN').length;
  const losses = evaluatedSignals.filter((s) => s.outcome === 'LOSS').length;
  const neutrals = evaluatedSignals.filter((s) => s.outcome === 'NEUTRAL').length;
  const totalActionable = wins + losses;
  const moves = evaluatedSignals
    .map((s) => Math.abs(s.pctChange ?? 0))
    .filter((v) => Number.isFinite(v));
  const avgPctMove =
    moves.length > 0 ? moves.reduce((acc, v) => acc + v, 0) / moves.length : 0;

  const agent: AgentStats = {
    totalEvaluated: evaluatedSignals.length,
    wins,
    losses,
    neutrals,
    winRate: totalActionable > 0 ? wins / totalActionable : 0,
    avgPctMove,
  };

  const board: LeaderEntry[] = users.map((u) => {
    const sells = u.trades.filter((t) => t.side === 'SELL');
    const realizedPnl = sells.reduce((acc, t) => acc + t.realizedPnl, 0);
    const approvalsYes = u.approvals.filter((a) => a.decision).length;
    const approvalsNo = u.approvals.filter((a) => !a.decision).length;

    let approvalsCorrect = 0;
    let approvalsEvaluated = 0;
    for (const ap of u.approvals) {
      const outcome = ap.signal?.outcome;
      if (!outcome || outcome === 'NEUTRAL') continue;
      approvalsEvaluated++;
      if (ap.decision && outcome === 'WIN') approvalsCorrect++;
      else if (!ap.decision && outcome === 'LOSS') approvalsCorrect++;
    }
    const approvalAccuracy =
      approvalsEvaluated > 0 ? approvalsCorrect / approvalsEvaluated : null;

    return {
      walletAddress: u.walletAddress,
      realizedPnl,
      trades: u.trades.length,
      approvalsYes,
      approvalsNo,
      approvalsCorrect,
      approvalsEvaluated,
      approvalAccuracy,
    };
  });

  // Primary sort: realised P&L desc. Secondary: accuracy desc (null low).
  board.sort((a, b) => {
    if (b.realizedPnl !== a.realizedPnl) return b.realizedPnl - a.realizedPnl;
    return (b.approvalAccuracy ?? -1) - (a.approvalAccuracy ?? -1);
  });

  return NextResponse.json({ agent, board: board.slice(0, limit) });
}
