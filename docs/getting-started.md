# Getting Started with Hunch It

This guide covers setting up the Hunch It platform. Choose between the zero-credential demo mode for a quick test drive, or the full live setup for production-like usage.

---

## Demo Mode

Demo mode allows you to run the application locally without external API keys or a database. It simulates the core websocket and UI behavior.

### Quick Start

Run these commands to start the demo environment.

```bash
# 1. Clone the repository
git clone https://github.com/Omnis-Labs/hunch-it.git
cd hunch-it

# 2. Install workspace dependencies
pnpm install

# 3. Copy base configuration (defaults are fine)
cp .env.example .env

# 4. Edit .env manually
# Open .env in your editor and set:
# DEMO_MODE=true
# NEXT_PUBLIC_DEMO_MODE=true

# 5. Propagate the environment file
cp .env apps/web/.env.local
cp .env apps/ws-server/.env

# 6. Generate Prisma client (offline, no DB needed)
pnpm --filter @hunch-it/web exec prisma generate

# 7. Start the development servers
pnpm dev
```

### What Is Faked

* The `ws-server` emits a hand-crafted signal every `DEMO_INTERVAL_SECONDS` (default 20s) rotating through an 8-ticker library.
* No Pyth network calls, no Anthropic LLM usage, no database writes, and no back-evaluator functionality.
* The SignalModal chart displays a deterministic random walk seeded per-ticker.
* Clicking "Yes, Execute" simulates quoting, awaits a signature, and submits with realistic delays. It returns a synthetic transaction signature. No wallet is actually required.
* The Portfolio and Leaderboard components read from in-memory Zustand fixtures.
* The landing page shows a yellow DEMO badge.

### What Is Real

* Next.js application layer.
* Socket.IO connection and transport.
* Shared Worker, cross-tab broadcasting, and browser notifications.
* Tab-title flasher, favicon dot, and Web Audio ding alerts.
* Framer Motion transitions and TradingView chart rendering.

---

## Full Setup from Zero

Follow these phases to configure a fully functional live environment. Expect this process to take around 30 minutes.

### Phase A: External Services (~15 min)

Gather the required credentials before starting the local environment setup.

| # | Service | Purpose | What you copy |
|---|---------|---------|---------------|
| 1 | Helius | Solana RPC | `https://mainnet.helius-rpc.com/?api-key=<key>` |
| 2 | Anthropic Console | Claude Haiku LLM (add ≥ $5 credit) | `sk-ant-...` |
| 3 | Neon | Postgres | `postgresql://user:pass@xxx.neon.tech/neondb?sslmode=require` |
| 4 | Upstash | Redis (REST) | `UPSTASH_REDIS_REST_URL` + `TOKEN` |
| 5 | OpenSSL | Shared secret | Run `openssl rand -base64 32` and copy the output |
| 6 | Privy | Auth + embedded Solana wallets | `NEXT_PUBLIC_PRIVY_APP_ID=cm...` |
| 7 | Phantom / Solflare / Backpack (optional) | Browser wallet | Fund with $1-2 USDC on mainnet |

### Phase B: Local Environment (~5 min)

Clone the repository, install dependencies, and configure your local environment.

```bash
# Verify Node.js version (needs >= 20)
node -v

# Enable corepack and prepare pnpm
corepack enable && corepack prepare pnpm@latest --activate

# Verify pnpm version (needs >= 9)
pnpm -v

# Clone the repository
git clone https://github.com/Omnis-Labs/hunch-it.git
cd hunch-it

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# PAUSE: Paste your Phase A values into the root .env file now.

# Propagate the configured environment file to the apps
cp .env apps/web/.env.local
cp .env apps/ws-server/.env
```

### Phase C: Populate Mints and Feed IDs

Resolve the required external data feeds and verify tokens on-chain. Run these using the `@hunch-it/ws-server` filter.

```bash
# C.1: Resolve Pyth feed IDs
pnpm --filter @hunch-it/ws-server fetch:pyth-feeds

# C.2: Author xstock-candidates.json, then verify mints on-chain
pnpm --filter @hunch-it/ws-server verify:xstocks
```

### Phase D: Database Setup

Generate the Prisma client and push your schema to the Neon Postgres instance.

```bash
# Generate Prisma client locally
pnpm db:generate

# Push schema to the remote database
pnpm db:push
```

### Phase E: Smoke Test

Run the end-to-end probe to verify your services and credentials are communicating correctly.

```bash
pnpm --filter @hunch-it/ws-server smoke
```

### Phase F: Run the Application

Start the development environment.

```bash
# Run web and ws-server concurrently
pnpm dev
```

Access the applications at these local URLs:
* **Web UI:** http://localhost:3000
* **WebSocket Server:** http://localhost:4000

---

## End-to-End Demo Flow

Once the live application is running, follow this sequence to test the complete user experience (takes ~3 minutes).

1. Open `http://localhost:3000` in your browser.
2. Connect your preferred wallet (Phantom, Solflare, or Backpack).
3. Complete the `/onboarding` flow (4 steps total).
4. Switch to a different browser tab to let the application run in the background.
5. Wait approximately 1 minute for the OS notification to trigger.
6. Click the notification. The Hunch It modal will open automatically.
7. Click "Yes, execute BUY" and sign the transaction in your wallet. A toast notification will confirm success.
8. Check the `/portfolio` and `/leaderboard` pages to view your updated state.

---

## Scripts Reference

Available workspace commands for development, building, and maintenance.

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Run web and ws-server concurrently |
| `pnpm dev:web` | Run Next.js frontend only |
| `pnpm dev:ws` | Run Socket.IO server only |
| `pnpm build` | Build every workspace |
| `pnpm typecheck` | Run `tsc --noEmit` in every workspace |
| `pnpm db:push` | Prisma database push |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm --filter @hunch-it/ws-server smoke` | Run the E2E probe |
| `pnpm --filter @hunch-it/ws-server fetch:pyth-feeds` | Resolve Pyth feed IDs |
| `pnpm --filter @hunch-it/ws-server verify:xstocks` | Verify token mints on-chain |
