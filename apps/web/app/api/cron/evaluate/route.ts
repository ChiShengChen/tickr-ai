import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vercel Cron target. Forwards to ws-server's `/cron/evaluate`, which scans
 * matured signals (>1h old, not yet evaluated) and writes their outcome.
 */
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(_req: NextRequest) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
  const secret = process.env.WS_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'WS_CRON_SECRET not configured' }, { status: 500 });
  }

  const r = await fetch(`${wsUrl}/cron/evaluate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: '{}',
  });

  const text = await r.text();
  const ct = r.headers.get('content-type') ?? 'application/json';
  return new NextResponse(text, { status: r.status, headers: { 'content-type': ct } });
}
