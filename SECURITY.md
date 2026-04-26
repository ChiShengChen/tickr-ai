# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Hunch It, **do not open a public issue**.

Instead, please report it privately:

1. Email the maintainers with a detailed description of the vulnerability.
2. Include steps to reproduce, potential impact, and any suggested fixes.
3. Allow reasonable time for a fix before public disclosure.

We aim to acknowledge reports within 48 hours and provide a fix or mitigation plan within 7 days.

## Scope

This policy covers the Hunch It codebase including:

- The Next.js web application (`apps/web`)
- The WebSocket server (`apps/ws-server`)
- Shared packages (`packages/shared`)

## Known Considerations

- **Private keys**: Hunch It uses Privy for embedded wallets and `@solana/wallet-adapter-react` for external wallets. Private keys never touch the server.
- **API secrets**: `WS_CRON_SECRET` protects the cron endpoints. Keep it out of client bundles.
- **LLM cost cap**: The `LLM_DAILY_USD_CAP` env var prevents runaway Anthropic spend.
