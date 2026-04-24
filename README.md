# SignalDesk

AI-powered trading assistant for tokenized US stocks (xStocks) on Solana. Built for **Solana Frontier Hackathon 2026 — Consumer Track**.

The desktop web app runs in the background. A signal engine on the ws-server cron-generates BUY/SELL signals using Pyth oracle prices + technical indicators + Claude Haiku, then pushes them to every open tab via a Shared Worker. If the tab is hidden, the user gets an OS-level notification; clicking it focuses the tab and opens a fullscreen approval modal. "Yes" triggers a Jupiter Ultra swap (gas sponsored).

## Stack

- **Web** — Next.js 15 App Router, React 19, Tailwind v4, shadcn/ui, Framer Motion, Zustand, TanStack Query
- **Wallet** — `@solana/wallet-adapter-react` (Phantom / Solflare / Backpack)
- **Realtime** — Socket.IO inside a **Shared Worker**, cross-tab via `broadcast-channel`
- **Notifications** — Native `Notification` API (no Service Worker, no PWA)
- **Charts** — `lightweight-charts` (TradingView)
- **WS server** — Node + Socket.IO + Express on Railway
- **LLM** — Anthropic SDK, `claude-haiku-4-5-20251001`
- **Oracles** — Pyth Hermes (`@pythnetwork/hermes-client`)
- **Swap** — Jupiter Ultra API (`/ultra/v1/order` + `/execute`)
- **DB** — Neon Postgres via Prisma
- **Cache** — Upstash Redis

## Repo layout

```
signaldesk/
├── apps/
│   ├── web/         # Next.js 15 app (Vercel)
│   └── ws-server/   # Socket.IO + signal engine (Railway)
└── packages/
    ├── shared/      # cross-app types + constants
    └── config/      # shared tsconfig
```

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

The web app reads `apps/web/.env.local` and the ws-server reads `apps/ws-server/.env`. Simplest: symlink the root `.env` into both, or copy.

```bash
cp .env apps/web/.env.local
cp .env apps/ws-server/.env
```

**4. Database**

```bash
pnpm db:generate   # generate Prisma client
pnpm db:push       # push schema to Neon (no migration files yet)
```

**5. Dev**

```bash
pnpm dev
# web      → http://localhost:3000
# ws-server → http://localhost:4000
```

## Verifying the bootstrap

Open the web app at `http://localhost:3000`, connect a wallet on `/onboarding`, then:

- Switch to another browser tab. Within ~30s you'll get a system notification from SignalDesk.
- Click the notification → the tab focuses and `/signals/<id>` opens the placeholder modal.
- Try `/debug/trade` to pull a live Jupiter Ultra quote and sign a real swap.

## Scripts

| Command            | What it does                                      |
|--------------------|---------------------------------------------------|
| `pnpm dev`         | Run web + ws-server concurrently                  |
| `pnpm dev:web`     | Next.js only                                      |
| `pnpm dev:ws`      | Socket.IO server only                             |
| `pnpm build`       | Build every workspace                             |
| `pnpm typecheck`   | `tsc --noEmit` in every workspace                 |
| `pnpm db:push`     | Prisma `db push` to the configured DATABASE_URL   |
| `pnpm db:studio`   | Prisma Studio                                     |

## Status (bootstrap session)

Implemented:

- Monorepo + workspaces, shared types & xStock constants
- Next.js app with wallet provider, onboarding, placeholder pages
- Jupiter Ultra `/debug/trade` quote + execute flow
- Prisma schema + scripts
- ws-server with Socket.IO, shared-secret cron endpoint, 30s fake signal loop
- Shared Worker + broadcast-channel cross-tab fan-out
- Notification API integration (hidden-tab notify, focus + route on click, sound/favicon/title flasher)

Stubbed / TODO:

- Real xStock mint addresses (empty until verifier paste — see `packages/shared/src/constants.ts`; runtime will refuse to load)
- Real Pyth equity feed IDs (same — run `pnpm --filter @signaldesk/ws-server fetch:pyth-feeds`)
- Signal-result back-evaluation cron (computing whether a signal "won" 1h later)
