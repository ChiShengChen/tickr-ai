# SignalDesk

AI-powered trading assistant for tokenized US stocks (xStocks) on Solana. Built for **Solana Frontier Hackathon 2026 — Consumer Track**.

The desktop web app runs in the background. A signal engine cron-generates BUY/SELL signals using Pyth prices + technical indicators + Claude Haiku, pushes them through a Shared Worker so every open tab sees the same event, and fires an OS-level notification when the tab is hidden. Clicking the notification focuses the tab and opens a fullscreen approval modal (chart + TTL countdown + Yes/No). "Yes" runs a Jupiter Ultra swap (gas sponsored). One hour later a back-evaluator grades each signal against the actual market move.

---

## Architecture

### Repo layout

```
signaldesk/
├── apps/
│   ├── web/                          # Next.js 15 App Router (Vercel)
│   │   ├── app/
│   │   │   ├── layout.tsx, providers.tsx, page.tsx, globals.css
│   │   │   ├── onboarding/           # 4-step wallet / notif / sound / tickers
│   │   │   ├── portfolio/            # positions + trades + P&L (live)
│   │   │   ├── leaderboard/          # agent banner + user accuracy
│   │   │   ├── signals/[id]/         # SignalModal entry (in-memory or cold read)
│   │   │   ├── debug/trade/          # manual Jupiter Ultra swap console
│   │   │   └── api/
│   │   │       ├── signals/{route,[id]}      # list + Postgres→Redis cold read
│   │   │       ├── approvals/                # upsert User + Approval
│   │   │       ├── trades/                   # persist swap + avgCost/position upsert
│   │   │       ├── portfolio/                # mark-to-market via Hermes
│   │   │       ├── leaderboard/              # agent + per-user ranking
│   │   │       ├── bars/[ticker]/            # Pyth Benchmarks proxy for charts
│   │   │       └── cron/{generate,evaluate}/ # Vercel Cron → ws-server
│   │   ├── components/
│   │   │   ├── wallet/               # Phantom / Solflare / Backpack
│   │   │   ├── signal-modal/         # fullscreen + chart + TTL ring
│   │   │   ├── charts/mini-chart.tsx # lightweight-charts area series
│   │   │   ├── notifications/        # title-flash, favicon-dot, Web Audio ding, NotificationClient
│   │   │   └── ui/                   # button, card
│   │   ├── lib/
│   │   │   ├── shared-worker/        # Shared Worker + broadcast-channel hook
│   │   │   ├── jupiter/              # Ultra REST + useJupiterSwap hook (BUY/SELL)
│   │   │   ├── pyth/                 # server-side Hermes REST helper
│   │   │   ├── solana/, redis/, db/  # singletons
│   │   │   └── store/                # Zustand (signals, walletUi)
│   │   ├── prisma/schema.prisma      # authoritative schema (ws-server points here)
│   │   └── vercel.json               # crons: */1 generate, */5 evaluate
│   └── ws-server/                    # Node Socket.IO + signal engine (Railway)
│       ├── src/
│       │   ├── index.ts              # HTTP + Socket.IO + /cron/{generate,evaluate}
│       │   ├── env.ts                # zod-parsed env (intervals, caps, bypass knobs)
│       │   ├── signals/
│       │   │   ├── generator.ts      # per-ticker loop with stagger + freshness gate
│       │   │   ├── indicators.ts     # RSI / MACD / MA via `technicalindicators`
│       │   │   ├── llm.ts            # Anthropic + rule fallback + daily USD cap
│       │   │   └── evaluator.ts      # +1h back-eval → WIN / LOSS / NEUTRAL
│       │   ├── pyth/{index,benchmarks}.ts  # Hermes + TradingView shim
│       │   ├── db/index.ts           # PrismaClient (shares web's schema)
│       │   └── cache/index.ts        # Upstash Redis + LLM spend counter
│       └── scripts/
│           ├── fetch-pyth-feeds.ts   # populates PYTH_FEED_IDS
│           ├── verify-xstock-mints.ts # validates mints on-chain
│           └── smoke-test.ts         # E2E: prices → bars → indicators → LLM
└── packages/
    ├── shared/                       # zod types, XSTOCKS, enums, helpers
    └── config/                       # shared tsconfig
```

### Infrastructure

| Layer       | Service                             | Role |
|-------------|-------------------------------------|------|
| Web         | Vercel                              | Next.js 15 App Router, Turbopack dev, Prisma client, Vercel Cron |
| WS server   | Railway                             | Express + Socket.IO, 2 cron loops (generate + evaluate), PrismaClient reads the same schema |
| DB          | Neon Postgres                       | Users / Signals / Approvals / Trades / Positions |
| Cache       | Upstash Redis                       | signal TTL cache, Pyth bar 60s cache, LLM daily spend counter (`llm:spend:YYYY-MM-DD`) |
| Oracle      | Pyth Hermes + Benchmarks            | live prices + historical 5-min bars + back-eval +1h bar |
| Swap        | Jupiter Ultra (`/order` + `/execute`) | gas sponsored |
| LLM         | Anthropic `claude-haiku-4-5-20251001` | JSON-mode analysis, rule-based fallback, daily USD cap |
| Wallets     | Phantom / Solflare / Backpack       | `@solana/wallet-adapter-react` |

### Event lifecycle

```
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

### Domain model (Prisma / Postgres)

```
User  ─┬─ Approval ─── Signal ─┬─ evaluatedAt, priceAfter, pctChange, outcome
       │                       │
       └─ Trade (realizedPnl) ─┘
       │
       └─ Position (weighted avgCost; unrealised P&L via Hermes at read time)

Signal.action   : BUY | SELL | HOLD
Signal.outcome  : WIN | LOSS | NEUTRAL
Trade.status    : PENDING | CONFIRMED | FAILED
```

### Runtime safety rails

- **No silent placeholders** — `requireMint()` / `requirePythFeedId()` throw if the constants are still empty, so Jupiter can't route USDC to an empty mint and Hermes can't be hit with a bad feed id.
- **Market-hours gate** — `evaluateFreshness()` skips generation when the price is older than 15 minutes and the NYSE/Nasdaq session is closed. Override with `BYPASS_MARKET_HOURS=true` for after-hours demos.
- **LLM daily cap** — per-day USD counter in Redis; breaching `LLM_DAILY_USD_CAP` flips the generator to the deterministic rule fallback and stamps `signal.degraded = true` so the modal shows "RULE FALLBACK".
- **Schema validation** — every WS payload, HTTP body and LLM response passes through zod. LLM validation failure also falls back to the rule engine.
- **Idempotent evaluator** — `WHERE evaluatedAt IS NULL` + update means re-runs are free; Vercel Cron and the in-process loop can coexist.
- **Prisma singleton** — Next.js hot-reload no longer leaks connections.

### Tunable env flags

| Variable                          | Default | Purpose |
|-----------------------------------|---------|---------|
| `BYPASS_MARKET_HOURS`             | false   | emit signals outside US session (demo) |
| `LLM_ENABLED`                     | true    | flip to force the rule fallback |
| `LLM_DAILY_USD_CAP`               | 10      | Haiku 4.5 cost ceiling |
| `SIGNAL_INTERVAL_SECONDS`         | 60      | one full ticker sweep per interval |
| `TICKER_STAGGER_SECONDS`          | 2       | delay between per-ticker calls (Hermes + Anthropic politeness) |
| `NEXT_PUBLIC_DEFAULT_TRADE_USD`   | 5       | default spend when the modal "Yes" path takes a BUY |
| `WS_CRON_SECRET`                  | (required) | shared secret Vercel Cron ↔ ws-server |

---

## Stack

- **Web** — Next.js 15 App Router, React 19, Tailwind v4, Framer Motion, Zustand, TanStack Query, sonner
- **Wallet** — `@solana/wallet-adapter-react` (Phantom / Solflare / Backpack)
- **Realtime** — Socket.IO inside a **Shared Worker**, cross-tab via `broadcast-channel`
- **Notifications** — native `Notification` API (no Service Worker, no PWA); Web Audio synth for the signal ding
- **Charts** — `lightweight-charts` (TradingView)
- **WS server** — Node + Socket.IO + Express
- **LLM** — Anthropic SDK, `claude-haiku-4-5-20251001`
- **Oracles** — Pyth Hermes (`@pythnetwork/hermes-client`) + Benchmarks tradingview shim
- **Swap** — Jupiter Ultra API (`/ultra/v1/order` + `/execute`)
- **DB** — Neon Postgres via Prisma
- **Cache** — Upstash Redis

## Setup

**1. Prereqs**

- Node ≥ 20
- pnpm ≥ 9 (`corepack enable && corepack prepare pnpm@latest --activate`)

**2. Install**

```bash
pnpm install
```

**3. Environment**

```bash
cp .env.example .env
# fill in:
#   NEXT_PUBLIC_SOLANA_RPC_URL (Helius)
#   ANTHROPIC_API_KEY
#   DATABASE_URL (Neon)
#   UPSTASH_REDIS_REST_URL / _TOKEN
#   WS_CRON_SECRET (any strong random string)
```

The web app reads `apps/web/.env.local` and the ws-server reads `apps/ws-server/.env`. Simplest: copy or symlink the root `.env` into both.

```bash
cp .env apps/web/.env.local
cp .env apps/ws-server/.env
```

**4. Verify mints + feed ids (one-time, required)**

```bash
# 1. Pyth feed ids → paste into packages/shared/src/constants.ts
pnpm --filter @signaldesk/ws-server fetch:pyth-feeds

# 2. xStock mints: author data/xstock-candidates.json with 8 ticker→mint entries, then:
pnpm --filter @signaldesk/ws-server verify:xstocks
```

Runtime `requireMint()` / `requirePythFeedId()` refuse to load until these are populated. This is deliberate — empty placeholders would happily route real USDC to `""`.

**5. Database**

```bash
pnpm db:generate   # generate Prisma client
pnpm db:push       # push schema to Neon (no migration files yet)
```

**6. Dev**

```bash
pnpm dev
# web       → http://localhost:3000
# ws-server → http://localhost:4000
```

## Verifying the full loop

1. Open `http://localhost:3000`, walk through `/onboarding` (wallet → notifications → sound unlock → monitored tickers).
2. Switch to another browser tab. Within ~60s you'll get a system notification from SignalDesk with real ticker + rationale.
3. Click it → the tab focuses, `/signals/<id>` opens the fullscreen modal (chart + TTL ring + live price line).
4. Click "Yes" → wallet signature → Jupiter Ultra `/execute` → `/portfolio` shows a new position.
5. Wait ~1 h → `/leaderboard` agent banner starts showing win rate as the back-evaluator grades the signal.
6. `/debug/trade` for a manual swap bypass.

## Scripts

| Command                                            | What it does |
|----------------------------------------------------|--------------|
| `pnpm dev`                                         | Run web + ws-server concurrently |
| `pnpm dev:web`                                     | Next.js only |
| `pnpm dev:ws`                                      | Socket.IO server only |
| `pnpm build`                                       | Build every workspace |
| `pnpm typecheck`                                   | `tsc --noEmit` in every workspace |
| `pnpm db:push`                                     | Prisma `db push` to the configured DATABASE_URL |
| `pnpm db:studio`                                   | Prisma Studio |
| `pnpm --filter @signaldesk/ws-server smoke`        | Prices → bars → indicators → LLM end-to-end probe |
| `pnpm --filter @signaldesk/ws-server fetch:pyth-feeds` | Resolve 8 Pyth equity feed ids |
| `pnpm --filter @signaldesk/ws-server verify:xstocks`   | Verify mint addresses on-chain (Helius) |

## Status

Implemented (Phases 1–5):

- Monorepo + pnpm workspaces, shared zod types, xStock/Pyth constants with load-time asserts
- Wallet flow, 4-step onboarding, landing page, Framer Motion polish
- Real Pyth Hermes prices + Benchmarks historical bars + market-hours gate
- Real Anthropic Haiku 4.5 signals with zod validation + daily USD cap + rule fallback
- Socket.IO + Shared Worker + broadcast-channel cross-tab fan-out
- Native Notification API with title flash / favicon dot / Web Audio synth
- Fullscreen signal modal with TTL ring + lightweight-charts mini-chart
- Jupiter Ultra integration (`/debug/trade` + modal "Yes" path via shared hook)
- Persistence: Approvals / Trades / Positions with weighted avgCost + realised P&L
- Portfolio with mark-to-market unrealised P&L, leaderboard with agent win rate
- 5-minute signal-outcome back-evaluator (Vercel Cron + in-process loop)

Intentional out-of-scope:

- Multi-agent leaderboard (currently one agent: the Haiku generator)
- Real-time Pyth WebSocket streaming (REST is sufficient)
- Mobile browsers — SharedWorker support is inconsistent; desktop only
