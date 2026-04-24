import { NextResponse, type NextRequest } from 'next/server';
import { ApprovalDecisionPayloadSchema } from '@signaldesk/shared';

// TODO: persist via Prisma (upsert user by wallet, insert Approval, optionally queue trade).
export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ApprovalDecisionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid payload', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, stubbed: true });
}
