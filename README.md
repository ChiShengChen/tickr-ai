# Hunch It

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

AI trading signals with one-tap execution for tokenized stocks & crypto on Solana.

A signal engine watches live Pyth prices, runs technical indicators + Claude Haiku, and pushes BUY/SELL signals to your browser via a Shared Worker. Approve with one click to fire a gas-sponsored Jupiter Ultra swap. Each signal is auto-graded against the actual market move one hour later.

## How It Works

```
Live Pyth prices + indicators + Claude Haiku → BUY/SELL signal
  → OS notification (background tab) or toast (foreground)
  → One-click approval → Jupiter Ultra swap (gas sponsored)
  → Portfolio tracking + 1h back-evaluation → Leaderboard
```

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind v4, Framer Motion, Zustand, TanStack Query |
| Wallet | Privy (email/Google/Apple + embedded wallet), Phantom / Solflare / Backpack |
| Realtime | Socket.IO via Shared Worker, BroadcastChannel, OS Notifications, Web Audio |
| Signals | Anthropic Claude Haiku 4.5, RSI / MACD / MA, Pyth Hermes + Benchmarks |
| Swap | Jupiter Ultra API (gas sponsored) |
| Storage | Neon Postgres (Prisma), Upstash Redis |

## Quick Start (Demo)

No API keys needed — demo mode simulates the full UX:

```bash
git clone https://github.com/Omnis-Labs/hunch-it.git
cd hunch-it
pnpm install
cp .env.example .env
# Set DEMO_MODE=true and NEXT_PUBLIC_DEMO_MODE=true in .env
cp .env apps/web/.env.local
cp .env apps/ws-server/.env
pnpm --filter @hunch-it/web exec prisma generate
pnpm dev
```

Open http://localhost:3000, complete onboarding, switch to another tab, and wait for a signal notification.

## Repo Structure

```
hunch-it/
├── apps/
│   ├── web/           # Next.js 15 App Router (Vercel)
│   └── ws-server/     # Node Socket.IO + signal engine (Railway)
└── packages/
    ├── shared/        # Zod types, xStock constants, enums
    └── config/        # Shared tsconfig
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run web + ws-server concurrently |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm db:push` | Push Prisma schema to database |
| `pnpm --filter @hunch-it/ws-server smoke` | End-to-end pipeline probe |

## Documentation

| Doc | Audience |
|---|---|
| [Getting Started](docs/getting-started.md) | Users & developers — demo mode, full setup (Phases A–F), scripts |
| [Architecture](docs/architecture.md) | Developers — repo layout, infrastructure, event lifecycle, domain model |
| [Troubleshooting](docs/troubleshooting.md) | Anyone — common issues and notification debugging |
| [Contributing](CONTRIBUTING.md) | Contributors — workflow, branch naming, code style |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and development workflow.

## License

[AGPL-3.0](LICENSE)
