import { NextResponse, type NextRequest } from 'next/server';
import { ApprovalDecisionPayloadSchema } from '@signaldesk/shared';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ApprovalDecisionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid payload', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { walletAddress, signalId, decision } = parsed.data;

  // Make sure the Signal row exists before referencing it. If the signal hasn't
  // hit Postgres yet (race with the ws-server writer), fall back to ack-only.
  const signal = await prisma.signal.findUnique({ where: { id: signalId } });
  if (!signal) {
    return NextResponse.json({ ok: true, deferred: true });
  }

  const user = await prisma.user.upsert({
    where: { walletAddress },
    update: {},
    create: { walletAddress },
  });

  const approval = await prisma.approval.upsert({
    where: { userId_signalId: { userId: user.id, signalId } },
    update: { decision, decidedAt: new Date() },
    create: { userId: user.id, signalId, decision },
  });

  return NextResponse.json({ ok: true, approval });
}
