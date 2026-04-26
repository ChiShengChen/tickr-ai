# Contributing to Hunch It

Thanks for your interest in contributing. This document covers the essentials.

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (via corepack)
- Git

## Setup

```bash
git clone https://github.com/Omnis-Labs/hunch-it.git
cd hunch-it
pnpm install
cp .env.example .env
```

See [docs/getting-started.md](docs/getting-started.md) for full setup instructions including demo mode.

## Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make your changes.** Follow the existing code style and patterns.

3. **Verify before pushing:**
   ```bash
   pnpm typecheck    # must pass
   pnpm build        # must succeed
   ```

4. **Open a pull request** against `main`. Describe what changed and why.

## Branch Naming

| Prefix | Use |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `refactor/` | Code restructuring (no behavior change) |
| `docs/` | Documentation only |
| `chore/` | Tooling, deps, CI |

## Code Style

- **Language**: All code, comments, commit messages, and documentation in English.
- **TypeScript**: Strict mode. No `as any`, no `@ts-ignore`.
- **Formatting**: Prettier handles it — run `pnpm format` before committing.
- **Imports**: Use workspace aliases (`@hunch-it/shared`, `@hunch-it/shared/constants`).
- **Validation**: Use Zod for runtime validation of external data.

## Commit Messages

Write concise messages that explain **why**, not just what. Examples:

```
feat: add position close button to portfolio page
fix: prevent duplicate signal evaluation on cron overlap
refactor: extract Jupiter swap logic into shared hook
```

## Documentation

When your changes affect setup, architecture, or user-facing behavior, update the corresponding file in `/docs`. See [agent.md](agent.md) for guidelines.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE).
