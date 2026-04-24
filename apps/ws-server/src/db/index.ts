// Stub Prisma accessor. Real build will import PrismaClient from
// @prisma/client and share it between web + ws-server via the schema in
// apps/web/prisma. Kept as a no-op during bootstrap so ws-server can run
// without a DATABASE_URL configured.
import type { Signal } from '@signaldesk/shared';

export async function persistSignal(signal: Signal): Promise<void> {
  // TODO: insert into `signals` table via Prisma.
  void signal;
}

export async function persistApprovalDecision(input: {
  walletAddress: string;
  signalId: string;
  decision: boolean;
}): Promise<void> {
  // TODO: upsert user by walletAddress, then insert/update approval row.
  void input;
}
