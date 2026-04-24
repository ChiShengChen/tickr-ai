import { z } from 'zod';

export const SignalActionSchema = z.enum(['BUY', 'SELL', 'HOLD']);
export type SignalAction = z.infer<typeof SignalActionSchema>;

export const PriceSnapshotSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  confidence: z.number(),
  publishTime: z.number(), // unix seconds
});
export type PriceSnapshot = z.infer<typeof PriceSnapshotSchema>;

export const BarSchema = z.object({
  time: z.number(), // unix seconds
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
});
export type Bar = z.infer<typeof BarSchema>;

export const IndicatorSnapshotSchema = z.object({
  rsi: z.number().nullable(),
  macd: z
    .object({
      macd: z.number(),
      signal: z.number(),
      histogram: z.number(),
    })
    .nullable(),
  ma20: z.number().nullable(),
  ma50: z.number().nullable(),
});
export type IndicatorSnapshot = z.infer<typeof IndicatorSnapshotSchema>;

export const SignalSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  action: SignalActionSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  ttlSeconds: z.number().int().positive(),
  priceAtSignal: z.number(),
  indicators: IndicatorSnapshotSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
  degraded: z.boolean().optional(), // true if produced by rule fallback (no LLM)
});
export type Signal = z.infer<typeof SignalSchema>;

export const LlmSignalOutputSchema = z.object({
  action: SignalActionSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(400),
  ttl_seconds: z.number().int().min(30).max(120),
});
export type LlmSignalOutput = z.infer<typeof LlmSignalOutputSchema>;

export const ApprovalSchema = z.object({
  id: z.string(),
  userId: z.string(),
  signalId: z.string(),
  decision: z.boolean(),
  decidedAt: z.string(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const TradeStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'FAILED']);
export type TradeStatus = z.infer<typeof TradeStatusSchema>;

export const TradeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  signalId: z.string().nullable(),
  ticker: z.string(),
  side: z.enum(['BUY', 'SELL']),
  amountUsd: z.number(),
  tokenAmount: z.number(),
  executionPrice: z.number(),
  txSignature: z.string(),
  status: TradeStatusSchema,
  createdAt: z.string(),
});
export type Trade = z.infer<typeof TradeSchema>;

export const PositionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  ticker: z.string(),
  tokenAmount: z.number(),
  avgCost: z.number(),
  updatedAt: z.string(),
});
export type Position = z.infer<typeof PositionSchema>;

// Socket.IO wire events
export const WsServerEvents = {
  SignalNew: 'signal:new',
  SignalExpired: 'signal:expired',
} as const;

export const WsClientEvents = {
  ApprovalDecision: 'approval:decision',
  Ping: 'ping',
} as const;

export const ApprovalDecisionPayloadSchema = z.object({
  signalId: z.string(),
  walletAddress: z.string(),
  decision: z.boolean(),
});
export type ApprovalDecisionPayload = z.infer<typeof ApprovalDecisionPayloadSchema>;

export const CronGenerateRequestSchema = z.object({
  ticker: z.string().optional(),
});
export type CronGenerateRequest = z.infer<typeof CronGenerateRequestSchema>;
