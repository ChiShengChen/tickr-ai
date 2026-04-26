# Troubleshooting

Common issues and their fixes when running Hunch It locally.

## Quick Reference

| Symptom | Likely Cause | Fix |
|---|---|---|
| `[constants] mint address for AAPL is empty` | Skipped Phase C.2 | Author `data/xstock-candidates.json`, run `verify:xstocks`, paste into `constants.ts` |
| `[constants] pyth feed id for AAPL is empty` | Skipped Phase C.1 | Run `fetch:pyth-feeds`, paste into `constants.ts` |
| Notifications don't appear when tab is hidden | Onboarding step 2 not completed | macOS: System Settings > Notifications > browser > Allow. Re-run `/onboarding` |
| Smoke test prints `market=CLOSED`, no signals | US market is closed | Add `BYPASS_MARKET_HOURS=true` to `.env` and restart |
| Modal "Yes" fails with `mint not verified` | Mint cell still empty in `constants.ts` | Re-check Phase C.2 in [Getting Started](./getting-started.md) |
| Leaderboard agent banner stays `0/0` for hours | Signals need 1h+ before back-eval | Wait, or generate more signals; `pnpm db:studio` to inspect `Signal.evaluatedAt` |
| First web page load is blank | Turbopack still compiling Shared Worker | Reload once |
| `anthropic call failed` in smoke | API key invalid or out of credit | Double-check `ANTHROPIC_API_KEY`, top up Anthropic console |

## Browser Notifications Checklist

If OS notifications aren't firing, check each item:

| Check | How to Verify |
|---|---|
| Browser permission granted | `/onboarding` step 2 must read **Status: granted**. Re-check via Chrome lock icon > Notifications > Allow |
| Tab is in the background | Switch to any other tab or window. Minimizing counts. Don't close the Hunch It tab — the Shared Worker dies with it |
| ws-server still emitting | Look for `[demo] emitted ...` or `[signal] emitted ...` lines every interval in the dev console |
| Shared Worker connected | Open Hunch It tab > DevTools > Console; look for a `connected` message |
| macOS system notifications enabled | System Settings > Notifications > Chrome/Safari/Firefox > Allow Notifications |
| Focus / Do Not Disturb off | macOS Control Centre (top-right) — check Focus is OFF |

The two most common offenders are **"didn't allow notifications in onboarding step 2"** and **"macOS Do Not Disturb is on"**.
