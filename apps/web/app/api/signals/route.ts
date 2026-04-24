import { NextResponse } from 'next/server';

// TODO: read from Prisma (Signal model), return latest N.
export async function GET() {
  return NextResponse.json({ signals: [] });
}
