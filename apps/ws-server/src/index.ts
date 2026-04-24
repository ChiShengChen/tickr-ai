import { createServer } from 'node:http';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { Server as IoServer } from 'socket.io';
import {
  ApprovalDecisionPayloadSchema,
  BARE_TICKERS,
  CronGenerateRequestSchema,
  WsClientEvents,
  type BareTicker,
} from '@signaldesk/shared';
import { env } from './env.js';
import { persistApprovalDecision, shutdownPrisma } from './db/index.js';
import { emitSignal, startSignalLoop } from './signals/generator.js';

const app = express();
app.use(cors({ origin: env.NEXT_PUBLIC_APP_URL, credentials: true }));
app.use(express.json({ limit: '256kb' }));

app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Vercel Cron hits this endpoint with the shared secret in the `Authorization`
// header. It generates one signal on demand and pushes it to connected tabs.
app.post('/cron/generate', async (req: Request, res: Response) => {
  const auth = req.header('authorization') ?? '';
  const expected = `Bearer ${env.WS_CRON_SECRET}`;
  if (auth !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const parsed = CronGenerateRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', issues: parsed.error.flatten() });
  }

  // Accept bare tickers (AAPL) or xStock symbols (AAPLx).
  const raw = parsed.data.ticker;
  let requested: BareTicker | undefined;
  if (raw) {
    const bare = raw.endsWith('x') ? raw.slice(0, -1) : raw;
    if (!BARE_TICKERS.includes(bare as BareTicker)) {
      return res.status(400).json({ error: `unknown ticker: ${raw}` });
    }
    requested = bare as BareTicker;
  }

  const signal = await emitSignal(io, requested);
  if (!signal) return res.status(502).json({ error: 'signal generation failed' });
  return res.json({ ok: true, signal });
});

const httpServer = createServer(app);
const io = new IoServer(httpServer, {
  cors: { origin: env.NEXT_PUBLIC_APP_URL, credentials: true },
});

io.on('connection', (socket) => {
  console.log(`[ws] connected: ${socket.id}`);

  socket.on(WsClientEvents.ApprovalDecision, async (payload: unknown) => {
    const parsed = ApprovalDecisionPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn('[ws] bad approval payload', parsed.error.flatten());
      return;
    }
    await persistApprovalDecision(parsed.data);
    console.log(
      `[ws] approval ${parsed.data.decision ? 'YES' : 'NO '} signal=${parsed.data.signalId} wallet=${parsed.data.walletAddress.slice(0, 6)}…`,
    );
  });

  socket.on(WsClientEvents.Ping, () => socket.emit('pong', Date.now()));

  socket.on('disconnect', (reason) => {
    console.log(`[ws] disconnected ${socket.id}: ${reason}`);
  });
});

const stopFakeLoop = startSignalLoop(io);

httpServer.listen(env.WS_SERVER_PORT, () => {
  console.log(`[http] signaldesk ws-server listening on :${env.WS_SERVER_PORT}`);
});

function shutdown(signal: string): void {
  console.log(`[ws] received ${signal}, shutting down`);
  stopFakeLoop();
  io.close();
  void shutdownPrisma();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
