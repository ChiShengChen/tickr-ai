import { NextResponse } from 'next/server';

// TODO: read positions/trades for the connected wallet from Prisma.
export async function GET() {
  return NextResponse.json({ positions: [], trades: [], pnl: { realized: 0, unrealized: 0 } });
}
