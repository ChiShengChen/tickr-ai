Technical architecture of Hunch It.

## Repo Layout

```text
hunch-it/
├── apps/
│   ├── web/           # Next.js 15 App Router (Vercel)
│   └── ws-server/     # Node Socket.IO + signal engine (Railway)
└── packages/
    ├── shared/        # zod types, XSTOCKS, enums, helpers
    └── config/        # shared tsconfig
```

## Infrastructure

| Layer | Service | Role |
|---|---|---|
| Web | Vercel | Next.js 15 App Router, Turbopack dev, Prisma client, Vercel Cron |
| WS server | Railway | Express + Socket.IO, 2 cron loops (generate + evaluate), PrismaClient reads the same schema |
| DB | Neon Postgres | Users / Signals / Approvals / Trades / Positions |
| Cache | Upstash Redis | signal TTL cache, Pyth bar 60s cache, LLM daily spend counter |
| Oracle | Pyth Hermes + Benchmarks | live prices + historical 5-min bars + back-eval +1h bar |
| Swap | Jupiter Ultra (/order + /execute) | gas sponsored |
| LLM | Anthropic claude-haiku-4-5 | JSON-mode analysis, rule-based fallback, daily USD cap |
| Wallets | Phantom / Solflare / Backpack | @solana/wallet-adapter-react |

## Event Lifecycle

```text
[Vercel Cron */1]   OR   [ws-server signal loop, interval=60s, stagger=2s/ticker]
        │                            │
        ▼                            ▼
POST /api/cron/generate  →  ws-server POST /cron/generate
                                     │
                                     ▼
                     generator.ts ──► getLatestPrices           (Hermes)
                                  └─► getHistoricalBars         (Benchmarks, 5min/24h)
                                  └─► computeIndicators         (RSI / MACD / MA)
                                  └─► runLlmSignal              (Anthropic Haiku 4.5
                                        ├─ 288→48 bar downsample
                                        ├─ JSON extraction + zod validation
                                        ├─ track cost vs LLM_DAILY_USD_CAP
                                        └─ degraded=true rule fallback)
                                  └─► freshness gate            (market hours or BYPASS)
                                  └─► drop if conf < 0.7 or HOLD
                                  └─► persist                   (Postgres + Redis TTL)
                                  └─► io.emit('signal:new', signal)
                                            │
                  ┌─────────────────────────┼─────────────────────────┐
                  ▼                                                   ▼
       Shared Worker (1 per browser)                        every other tab
                  │                                                   │
            BroadcastChannel  ────────────────────────────────────────┘
                  │
                  ▼
       NotificationClient (mounted in providers.tsx)
                  │
                  ├─ visible tab → sonner toast + router.push(/signals/:id)
                  │       └─► SignalModal (Framer Motion entrance)
                  │            ├─ chart: GET /api/bars/:ticker
                  │            ├─ TTL ring (green→yellow→red)
                  │            └─ [Yes / No]
                  │
                  └─ hidden tab → Notification() + title flash + favicon dot + Web Audio ding
                         │
                         └─ on click → window.focus() + push(/signals/:id)

User clicks "Yes" in modal:
    useJupiterSwap
        │
        ├─ BUY:  requestUltraOrder(USDC → xStock, $5 default)
        ├─ SELL: getParsedTokenAccountsByOwner → sell whole xStock balance
        ├─ wallet.signTransaction(VersionedTransaction)
        ├─ executeUltraOrder                                 (gas sponsored)
        │
        ├─► POST /api/approvals  → upsert User + Approval
        └─► POST /api/trades     → insert Trade, compute realizedPnl (SELL),
                                   weighted-avg Position.avgCost (BUY)

[Vercel Cron */5]  OR  [ws-server eval loop, every 5 min, first run 30s after boot]
        │                     │
        ▼                     ▼
POST /api/cron/evaluate → ws-server /cron/evaluate
                               │
                               ▼
                     evaluator.ts: for each Signal where
                       createdAt <= now-1h AND evaluatedAt IS NULL (batch 50)
                          ├─ getBarsRange(bare, '5', t-600, t+900)
                          ├─ bar.close covering createdAt+1h → priceAfter
                          ├─ pctChange = (priceAfter - priceAtSignal) / priceAtSignal
                          ├─ classify:
                          │     HOLD or |Δ| < 0.1% → NEUTRAL
                          │     BUY + Δ > 0   or SELL + Δ < 0 → WIN
                          │     opposite                       → LOSS
                          └─ UPDATE signal (idempotent via WHERE evaluatedAt IS NULL)

Leaderboard reads the graded signals:
  - agent stats    : winRate = wins / (wins + losses)
  - user accuracy  : (Yes+WIN ∪ No+LOSS) / non-NEUTRAL evaluated approvals
```

## Domain Model

```text
User  ─┬─ Approval ─── Signal ─┬─ evaluatedAt, priceAfter, pctChange, outcome
       │                       │
       └─ Trade (realizedPnl) ─┘
       │
       └─ Position (weighted avgCost; unrealised P&L via Hermes at read time)

Signal.action   : BUY | SELL | HOLD
Signal.outcome  : WIN | LOSS | NEUTRAL
Trade.status    : PENDING | CONFIRMED | FAILED
```

## Runtime Safety Rails

*   **No silent placeholders**: `requireMint()` and `requirePythFeedId()` throw immediately if the constants are still empty.
*   **Market-hours gate**: `evaluateFreshness()` skips generation when the price is older than 15 minutes and the NYSE/Nasdaq session is closed. Override with `BYPASS_MARKET_HOURS=true`.
*   **LLM daily cap**: A per-day USD counter is maintained in Redis. Breaching `LLM_DAILY_USD_CAP` flips generation to the rule fallback and stamps the signal with `degraded = true`.
*   **Schema validation**: Every WebSocket payload, HTTP body, and LLM response passes through Zod validation.
*   **Idempotent evaluator**: The `WHERE evaluatedAt IS NULL` check ensures that updates are idempotent, meaning evaluator re-runs are side-effect free.
*   **Prisma singleton**: Prevents Next.js hot-reload from leaking database connections.

## Tunable Env Flags

| Variable | Default | Purpose |
|---|---|---|
| `BYPASS_MARKET_HOURS` | `false` | Emit signals outside US session (useful for demos). |
| `LLM_ENABLED` | `true` | Flip to force the rule-based fallback. |
| `LLM_DAILY_USD_CAP` | `10` | Haiku 4.5 cost ceiling. |
| `SIGNAL_INTERVAL_SECONDS` | `60` | Time required for one full ticker sweep per interval. |
| `TICKER_STAGGER_SECONDS` | `2` | Delay between per-ticker calls. |
| `NEXT_PUBLIC_DEFAULT_TRADE_USD` | `5` | Default spend when modal "Yes" takes a BUY order. |
| `WS_CRON_SECRET` | *(required)* | Shared secret for Vercel Cron ↔ ws-server communication. |
