// Hunch It — canonical constants for tickers, mints, oracles.
//
// xStock metadata. The `mint` and `pythFeedId` fields are intentionally empty
// strings: Phase 2 requires verified-on-chain values, and we'd rather crash at
// load than route real USDC to a placeholder address. Run the verifier scripts
// in `apps/ws-server/scripts/` to populate them:
//
//   pnpm --filter @hunch-it/ws-server fetch:pyth-feeds   # writes pyth-feeds.json
//   pnpm --filter @hunch-it/ws-server verify:xstocks     # writes xstock-mints.json
//
// then paste the addresses below and re-run `pnpm typecheck`.

export interface XStockMeta {
  ticker: BareTicker; // pure ticker symbol used by Pyth (e.g. "AAPL")
  symbol: XStockTicker; // on-chain symbol with "x" suffix (e.g. "AAPLx")
  name: string;
  mint: string; // SPL Token-2022 mint, base58
  decimals: number;
  pythFeedId: string; // 0x-prefixed 32-byte hex
}

export const XSTOCKS: Record<BareTicker, XStockMeta> = {
  AAPL: {
    ticker: 'AAPL',
    symbol: 'AAPLx',
    name: 'Apple xStock',
    mint: '',
    decimals: 8,
    pythFeedId: '',
  },
  NVDA: {
    ticker: 'NVDA',
    symbol: 'NVDAx',
    name: 'NVIDIA xStock',
    mint: '',
    decimals: 8,
    pythFeedId: '',
  },
  TSLA: {
    ticker: 'TSLA',
    symbol: 'TSLAx',
    name: 'Tesla xStock',
    mint: '',
    decimals: 8,
    pythFeedId: '',
  },
  SPY: {
    ticker: 'SPY',
    symbol: 'SPYx',
    name: 'S&P 500 xStock',
    mint: '',
    decimals: 8,
    pythFeedId: '',
  },
  QQQ: {
    ticker: 'QQQ',
    symbol: 'QQQx',
    name: 'Nasdaq 100 xStock',
    mint: '',
    decimals: 8,
    pythFeedId: '',
  },
  MSFT: {
    ticker: 'MSFT',
    symbol: 'MSFTx',
    name: 'Microsoft xStock',
    mint: '',
    decimals: 8,
    pythFeedId: '',
  },
  GOOGL: {
    ticker: 'GOOGL',
    symbol: 'GOOGLx',
    name: 'Alphabet xStock',
    mint: '',
    decimals: 8,
    pythFeedId: '',
  },
  META: {
    ticker: 'META',
    symbol: 'METAx',
    name: 'Meta xStock',
    mint: '',
    decimals: 8,
    pythFeedId: '',
  },
};

export const BARE_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'SPY', 'QQQ', 'MSFT', 'GOOGL', 'META'] as const;
export type BareTicker = (typeof BARE_TICKERS)[number];

export const XSTOCK_TICKERS = [
  'AAPLx',
  'NVDAx',
  'TSLAx',
  'SPYx',
  'QQQx',
  'MSFTx',
  'GOOGLx',
  'METAx',
] as const;
export type XStockTicker = (typeof XSTOCK_TICKERS)[number];

// Back-compat shim for code paths that previously read `XSTOCK_MINTS[ticker]`
// as a plain string. Empty until populated by verifier.
export const XSTOCK_MINTS: Record<XStockTicker, string> = {
  AAPLx: XSTOCKS.AAPL.mint,
  NVDAx: XSTOCKS.NVDA.mint,
  TSLAx: XSTOCKS.TSLA.mint,
  SPYx: XSTOCKS.SPY.mint,
  QQQx: XSTOCKS.QQQ.mint,
  MSFTx: XSTOCKS.MSFT.mint,
  GOOGLx: XSTOCKS.GOOGL.mint,
  METAx: XSTOCKS.META.mint,
};

export const PYTH_FEED_IDS: Record<BareTicker, string> = {
  AAPL: XSTOCKS.AAPL.pythFeedId,
  NVDA: XSTOCKS.NVDA.pythFeedId,
  TSLA: XSTOCKS.TSLA.pythFeedId,
  SPY: XSTOCKS.SPY.pythFeedId,
  QQQ: XSTOCKS.QQQ.pythFeedId,
  MSFT: XSTOCKS.MSFT.pythFeedId,
  GOOGL: XSTOCKS.GOOGL.pythFeedId,
  META: XSTOCKS.META.pythFeedId,
};

// Hard guard: if any consumer pulls a still-empty value at runtime, crash with a
// clear message instead of forwarding USDC to '' or hitting Hermes with a bad ID.
export function requireMint(ticker: BareTicker | XStockTicker): string {
  const meta = ticker.endsWith('x')
    ? XSTOCKS[ticker.slice(0, -1) as BareTicker]
    : XSTOCKS[ticker as BareTicker];
  if (!meta || !meta.mint) {
    throw new Error(
      `[constants] mint address for ${ticker} is empty. Run \`pnpm --filter @hunch-it/ws-server verify:xstocks\` and paste the result into packages/shared/src/constants.ts.`,
    );
  }
  return meta.mint;
}

export function requirePythFeedId(ticker: BareTicker | XStockTicker): string {
  const meta = ticker.endsWith('x')
    ? XSTOCKS[ticker.slice(0, -1) as BareTicker]
    : XSTOCKS[ticker as BareTicker];
  if (!meta || !meta.pythFeedId) {
    throw new Error(
      `[constants] pyth feed id for ${ticker} is empty. Run \`pnpm --filter @hunch-it/ws-server fetch:pyth-feeds\` and paste the result into packages/shared/src/constants.ts.`,
    );
  }
  return meta.pythFeedId;
}

export function bareToXStock(t: BareTicker): XStockTicker {
  return `${t}x` as XStockTicker;
}
export function xStockToBare(t: XStockTicker): BareTicker {
  return t.slice(0, -1) as BareTicker;
}

// Solana program IDs.
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// USDC mainnet mint — used as the quote asset in Jupiter Ultra orders.
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_DECIMALS = 6;

// Jupiter Ultra API endpoints (gas sponsored; see https://dev.jup.ag/docs/ultra-api).
export const JUPITER_ULTRA_ORDER = '/ultra/v1/order';
export const JUPITER_ULTRA_EXECUTE = '/ultra/v1/execute';

// Pyth.
export const PYTH_HERMES_DEFAULT_URL = 'https://hermes.pyth.network';
export const PYTH_BENCHMARKS_BASE = 'https://benchmarks.pyth.network';

// Default signal TTL bounds (seconds).
export const SIGNAL_TTL_MIN = 30;
export const SIGNAL_TTL_MAX = 120;
export const SIGNAL_TTL_DEFAULT = 30;

// Confidence threshold at which a LLM output is allowed to be BUY/SELL.
export const MIN_ACTIONABLE_CONFIDENCE = 0.7;

// Solscan link helper for UI.
export function solscanTokenUrl(mint: string): string {
  return `https://solscan.io/token/${mint}`;
}
