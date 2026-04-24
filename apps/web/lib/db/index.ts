import { PrismaClient } from '@prisma/client';

// Singleton across hot reloads (Next.js dev rebuilds modules; without this we'd
// leak connections every save).
const globalForPrisma = globalThis as unknown as { _prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma._prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma._prisma = prisma;
}
