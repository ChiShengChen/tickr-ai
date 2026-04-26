# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-04-26

### Added

- AI signal engine: Pyth prices + technical indicators + Claude Haiku generate BUY/SELL signals
- One-tap execution via Jupiter Ultra (gas-sponsored swaps)
- Real-time notifications: Shared Worker + BroadcastChannel + OS notifications + Web Audio
- Portfolio tracking with weighted average cost and mark-to-market P&L
- Signal back-evaluator: grades each signal WIN/LOSS/NEUTRAL after 1 hour
- Leaderboard with agent win rate and per-user accuracy
- Demo mode: full UX without external credentials
- 4-step onboarding flow (wallet, notifications, sound, tickers)

### Changed

- Project renamed from SignalDesk to Hunch It
- Package scope changed from `@signaldesk/*` to `@hunch-it/*`
- License set to AGPL-3.0
