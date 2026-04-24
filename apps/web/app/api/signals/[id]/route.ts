import { NextResponse } from 'next/server';
import type { Signal } from '@signaldesk/shared';
import { prisma } from '@/lib/db';
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
