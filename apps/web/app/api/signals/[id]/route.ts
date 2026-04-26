import { NextResponse } from 'next/server';
import { makeDemoSignal, type Signal } from '@hunch-it/shared';
import { prisma } from '@/lib/db';
import { isDemoServer } from '@/lib/demo/flag';
import { getRedis } from '@/lib/redis';

interface PrismaSignalRow {
  id: string;
  ticker: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  rationale: string;
  ttlSeconds: number;
  priceAtSignal: number;
  indicators: unknown;
  createdAt: Date;
  expiresAt: Date;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function rowToSignal(row: PrismaSignalRow): Signal {
  return {
    id: row.id,
    ticker: row.ticker,
    action: row.action,
    confidence: row.confidence,
    rationale: row.rationale,
    ttlSeconds: row.ttlSeconds,
    priceAtSignal: row.priceAtSignal,
    indicators: row.indicators as Signal['indicators'],
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  if (isDemoServer()) {
    // Synthesise a signal so a cold refresh / shared link still lands on a modal.
    const signal = { ...makeDemoSignal(Math.abs(hash(id))), id };
    return NextResponse.json({ signal, source: 'demo' });
  }

  // 1) Postgres (authoritative)
  const row = await prisma.signal.findUnique({ where: { id } });
  if (row) {
    return NextResponse.json({ signal: rowToSignal(row), source: 'postgres' });
  }

  // 2) Redis cache (signals are written here with TTL by ws-server)
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>(`signal:${id}`);
    if (raw) {
      try {
        const signal = JSON.parse(raw) as Signal;
        return NextResponse.json({ signal, source: 'redis' });
      } catch {
        /* fall through */
      }
    }
  }

  return NextResponse.json({ error: 'signal not found' }, { status: 404 });
}
