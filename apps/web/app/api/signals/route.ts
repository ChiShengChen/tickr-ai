import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '50'), 200);
  const signals = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return NextResponse.json({ signals });
}
