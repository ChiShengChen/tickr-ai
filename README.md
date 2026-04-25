# SignalDesk

AI-powered trading assistant for tokenized US stocks (xStocks) on Solana. Built for **Solana Frontier Hackathon 2026 — Consumer Track**.

The desktop web app runs in the background. A signal engine cron-generates BUY/SELL signals using Pyth prices + technical indicators + Claude Haiku, pushes them through a Shared Worker so every open tab sees the same event, and fires an OS-level notification when the tab is hidden. Clicking the notification focuses the tab and opens a fullscreen approval modal (chart + TTL countdown + Yes/No). "Yes" runs a Jupiter Ultra swap (gas sponsored). One hour later a back-evaluator grades each signal against the actual market move.

---

## TL;DR

> Feed **live Pyth equity prices** into **Claude Haiku** to produce AI trading signals, fan them to every open browser tab via a **Shared Worker + OS notifications**, let the user approve with a single click to fire a **gas-sponsored Jupiter Ultra swap** into an xStock, then auto-grade each signal an hour later against the actual Pyth move — all running on **Next.js + Socket.IO + Neon + Upstash**.

### User flow (≈ 3 min)

```
Connect wallet (Phantom / Solflare / Backpack)
  ↓
Onboarding — allow OS notifications, unlock sound, review 8 monitored tickers
  ↓
Switch to another tab, leave SignalDesk running in the background
  ↓  (~1 min later)
OS notification pops: "BUY AAPLx · RSI oversold + MACD bullish"
  tab-title flashes · favicon gets a red dot · Web Audio ding
  ↓  click the notification
Tab refocuses, fullscreen modal opens:
  ticker · confidence ring · 24h chart (dashed line at priceAtSignal)
  rationale · 30s TTL countdown (green → yellow → red)
  ↓  press "Yes, Execute"
Wallet prompts for signature → Jupiter Ultra /execute (gas sponsored)
  ↓
Portfolio page: new position with weighted avgCost + mark-to-market P&L + Solscan tx
  ↓  (~1 h later)
Leaderboard agent banner: the back-evaluator grades this signal WIN / LOSS / NEUTRAL
```

Full loop: **AI decides → user approves → on-chain swap → positions tracked → outcome graded → leaderboard updates**.

### Tech stack (one line each)

**Frontend**
- **Next.js 15 App Router + React 19** — framework
- **Tailwind v4 + Framer Motion** — styling + transitions
- **Zustand** — local state (in-memory signals)
- **TanStack Query** — server state (portfolio / leaderboard auto-refetch)
- **sonner** — toast
- **lightweight-charts** — TradingView area chart inside the signal modal
- **Shared Worker + broadcast-channel** — one WebSocket shared across every tab
- **Web Audio API** — synthesised ding, no mp3 shipped
- **Notification API** — native OS notifications (no Service Worker / no PWA)

**Wallet + on-chain**
- **@solana/wallet-adapter-react** — Phantom / Solflare / Backpack
- **Jupiter Ultra API** — one-shot swap, **gas sponsored**
- **SPL Token-2022** — xStocks mint standard

**Data sources**
- **Pyth Hermes** — live prices (`Equity.US.<TICKER>/USD` × 8)
- **Pyth Benchmarks** — 5-min OHLC history (TradingView shim)

**Backend**
- **Node.js + Express + Socket.IO** — WebSocket server (Railway)
- **Anthropic SDK / Claude Haiku 4.5** — structured-JSON signal generator
- **technicalindicators** — RSI / MACD / MA20 / MA50
- **Zod** — runtime validation for every payload

**Storage**
- **Neon Postgres + Prisma** — 5 tables (User / Signal / Approval / Trade / Position)
- **Upstash Redis** — signal TTL cache + Pyth bar cache + LLM daily spend counter

**Scheduling**
- **Vercel Cron** — */1 min generate, */5 min evaluate
- **ws-server setInterval** — same two loops in-process for local dev

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

## Getting started from zero

First-time end-to-end is ~30 minutes. Every step below is required.

### Phase A — External services (~15 min)

All free tiers are enough to demo.

| # | Service | Purpose | What you copy |
|---|---------|---------|---------------|
| 1 | [Helius](https://helius.dev) | Solana RPC | `https://mainnet.helius-rpc.com/?api-key=<key>` |
| 2 | [Anthropic Console](https://console.anthropic.com) | Claude Haiku LLM (add ≥ $5 credit) | `sk-ant-...` |
| 3 | [Neon](https://neon.tech) | Postgres | `postgresql://user:pass@xxx.neon.tech/neondb?sslmode=require` |
| 4 | [Upstash](https://upstash.com) | Redis (REST) | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| 5 | `openssl rand -base64 32` | shared secret between Vercel Cron ↔ ws-server | the random string |
| 6 | Phantom / Solflare / Backpack | browser wallet — fund with **$1–2 USDC on mainnet** (mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) | address stays local |

### Phase B — Local env (~5 min)

```bash
# 1. Tooling
node -v                                                   # needs >= 20
corepack enable && corepack prepare pnpm@latest --activate
pnpm -v                                                   # needs >= 9

# 2. Clone
git clone https://github.com/ChiShengChen/tickr-ai.git
cd tickr-ai

# 3. Install
pnpm install

# 4. Env
cp .env.example .env
# open .env and paste the 6 values from Phase A:
#   NEXT_PUBLIC_SOLANA_RPC_URL
#   ANTHROPIC_API_KEY
#   DATABASE_URL
#   UPSTASH_REDIS_REST_URL / _TOKEN
#   WS_CRON_SECRET

# 5. Mirror env into each app (ws-server reads its own .env; web reads .env.local)
cp .env apps/web/.env.local
cp .env apps/ws-server/.env
```

### Phase C — Populate mints + feed ids (one-time, required)

This is intentionally non-automated. `requireMint()` / `requirePythFeedId()` throw at load time if these are still empty — so real USDC cannot be routed to `""` and Hermes cannot be queried with a bad id.

**C.1 Pyth feed ids**

```bash
pnpm --filter @signaldesk/ws-server fetch:pyth-feeds
```

Output:
```
AAPL: { ...XSTOCKS.AAPL, pythFeedId: '0xb5d0e0fa58a...' },  // Equity.US.AAPL/USD
NVDA: { ...XSTOCKS.NVDA, pythFeedId: '0x...' },
...
```
Paste each `pythFeedId` value into the matching entry in [`packages/shared/src/constants.ts`](packages/shared/src/constants.ts) → `XSTOCKS`.

**C.2 xStock mints**

Author `apps/ws-server/data/xstock-candidates.json` (source the mints from https://xstocks.com/products or by searching Solscan for `AAPLx` / `NVDAx` / …):

```json
{
  "AAPL": "<AAPLx mint base58>",
  "NVDA": "<NVDAx mint base58>",
  "TSLA": "<TSLAx mint base58>",
  "SPY":  "<SPYx mint base58>",
  "QQQ":  "<QQQx mint base58>",
  "MSFT": "<MSFTx mint base58>",
  "GOOGL": "<GOOGLx mint base58>",
  "META": "<METAx mint base58>"
}
```

Run the verifier:

```bash
pnpm --filter @signaldesk/ws-server verify:xstocks
```

It checks each mint via Helius: owner must be SPL Token-2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`), decimals must be 8. On success it prints a paste-ready snippet; drop each `mint` value into the same `XSTOCKS` entries in `constants.ts`.

### Phase D — Database

```bash
pnpm db:generate   # generate Prisma client (both apps)
pnpm db:push       # create the 5 tables + SignalOutcome enum on Neon
```

### Phase E — Smoke test (required)

Before `pnpm dev`, confirm the pipeline end-to-end:

```bash
pnpm --filter @signaldesk/ws-server smoke
```

Expected:
```
--- 1. Pyth latest prices ---
  AAPL   $230.12  conf±0.0042  age=3s  market=OPEN
  NVDA   $920.45  ...
--- 2. AAPL historical bars (5min, 24h) ---
  total bars: 288
  first: ...
  last:  ...
--- 3. AAPL indicators ---
  RSI(14): 52.31
  MACD:    macd=0.12 signal=0.08 hist=0.04
  MA20:    229.80
  MA50:    228.10
--- 4. LLM signal (AAPL) ---
  action:     HOLD
  confidence: 0.65
  rationale:  RSI=52 neutral...
  tokens:     in=820 out=115 cost=$0.0014
✅ smoke test ok
```

If this fails, don't move on. See *Troubleshooting* below.

### Phase F — Run it

```bash
pnpm dev
# web        → http://localhost:3000
# ws-server  → http://localhost:4000
#              [signal] loop running interval=60s stagger=2s tickers=8
#              [eval]   back-evaluator running every 5 min
```

## End-to-end demo flow (~3 minutes)

1. Open http://localhost:3000.
2. Click the wallet button in the top-right, connect Phantom/Solflare/Backpack.
3. Go to `/onboarding` and complete all 4 steps: wallet → **allow browser notifications** (required) → "Unlock & test" to play the synth ding → review the 8 monitored tickers.
4. Back to home. Switch to **another browser tab** (leave SignalDesk open in the background).
5. Wait ~1 minute. An OS notification pops up, e.g. **SignalDesk · BUY AAPLx**. The title bar flashes, the favicon gets a red dot, the ding plays.
6. Click the notification → SignalDesk tab refocuses → `/signals/<id>` opens the fullscreen modal (ticker, confidence ring, rationale, 24h chart with `priceAtSignal` dashed line, 30s TTL countdown).
7. Click **Yes, execute BUY** → wallet prompts for a signature → toast confirms `BUY AAPLx confirmed`.
8. Open `/portfolio` — the new position, a Trade row with a Solscan tx link, realised/unrealised P&L.
9. Wait ~1 hour → `/leaderboard` agent banner's win rate starts moving as the back-evaluator grades the signal.

Or skip the wait with **`/debug/trade`** — pick ticker + USD amount → one-button sign & swap bypasses the signal flow entirely and still persists to the DB.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `[constants] mint address for AAPL is empty` | skipped Phase C.2 | author `data/xstock-candidates.json`, run `verify:xstocks`, paste into `constants.ts` |
| `[constants] pyth feed id for AAPL is empty` | skipped Phase C.1 | run `fetch:pyth-feeds`, paste into `constants.ts` |
| Notifications don't appear when tab is hidden | onboarding step 2 not completed | macOS: System Settings → Notifications → Chrome/Firefox/Safari → Allow. Re-run `/onboarding` |
| Smoke test prints `market=CLOSED` and signals never fire | US market is closed (weekend / out-of-hours) | add `BYPASS_MARKET_HOURS=true` to `.env` and restart |
| Modal "Yes" fails with `⚠ AAPLx mint not verified` | mint cell still empty in `constants.ts` | re-check Phase C.2 |
| Leaderboard agent banner stays `0/0 — %` for hours | signals need ≥ 1 h before back-eval | wait, or generate more signals; `pnpm db:studio` to inspect `Signal.evaluatedAt` |
| First web page load is blank | Turbopack still compiling the Shared Worker bundle | reload once |
| `anthropic call failed` in smoke | API key invalid or account out of credit | double-check `ANTHROPIC_API_KEY`, top up Anthropic console |

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
