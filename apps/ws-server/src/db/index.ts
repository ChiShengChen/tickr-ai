import { PrismaClient } from '@prisma/client';
import type { Signal } from '@signaldesk/shared';
import { env } from '../env.js';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient | null {
  if (prisma) return prisma;
  if (!env.DATABASE_URL) return null;
  prisma = new PrismaClient({
    log: ['error'],
  });
  return prisma;
}

export async function persistSignal(signal: Signal): Promise<void> {
  const p = getPrisma();
  if (!p) return;
  try {
    await p.signal.create({
      data: {
        id: signal.id,
        ticker: signal.ticker,
        action: signal.action,
        confidence: signal.confidence,
        rationale: signal.rationale,
        ttlSeconds: signal.ttlSeconds,
        priceAtSignal: signal.priceAtSignal,
        indicators: signal.indicators as unknown as object,
        createdAt: new Date(signal.createdAt),
        expiresAt: new Date(signal.expiresAt),
      },
    });
  } catch (err) {
    console.warn('[db] persistSignal failed', err);
  }
}

export async function persistApprovalDecision(input: {
  walletAddress: string;
  signalId: string;
  decision: boolean;
}): Promise<void> {
  const p = getPrisma();
  if (!p) return;
  try {
    const user = await p.user.upsert({
      where: { walletAddress: input.walletAddress },
      update: {},
      create: { walletAddress: input.walletAddress },
    });
    await p.approval.upsert({
      where: { userId_signalId: { userId: user.id, signalId: input.signalId } },
      update: { decision: input.decision, decidedAt: new Date() },
      create: {
        userId: user.id,
        signalId: input.signalId,
        decision: input.decision,
      },
    });
  } catch (err) {
    console.warn('[db] persistApprovalDecision failed', err);
  }
}

export async function shutdownPrisma(): Promise<void> {
  if (prisma) await prisma.$disconnect();
}
