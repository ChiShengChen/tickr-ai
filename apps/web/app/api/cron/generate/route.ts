import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vercel Cron target. Forwards the request to the ws-server so that its
 * Socket.IO can actually emit `signal:new` to every connected tab. We keep
 * this in Next.js so the crontab lives in vercel.json and stays close to the
 * rest of the app.
 */
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
  const secret = process.env.WS_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'WS_CRON_SECRET not configured' }, { status: 500 });
  }

  // Vercel Cron adds `Authorization: Bearer $CRON_SECRET`; accept either that
  // header or fall through with ours.
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker') ?? undefined;

  const r = await fetch(`${wsUrl}/cron/generate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(ticker ? { ticker } : {}),
  });

  const text = await r.text();
  const contentType = r.headers.get('content-type') ?? 'application/json';
  return new NextResponse(text, { status: r.status, headers: { 'content-type': contentType } });
}
