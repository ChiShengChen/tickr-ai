'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  BARE_TICKERS,
  USDC_DECIMALS,
  USDC_MINT,
  XSTOCKS,
  solscanTokenUrl,
  type BareTicker,
} from '@signaldesk/shared';
import {
  executeUltraOrder,
  requestUltraOrder,
  type UltraExecuteResponse,
  type UltraOrderResponse,
} from '@/lib/jupiter';
import { WalletButton } from '@/components/wallet/wallet-button';

function toBase64(bytes: Uint8Array): string {
  if (typeof window === 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return window.btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  if (typeof window === 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
  const binary = window.atob(str);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

export default function DebugTradePage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [ticker, setTicker] = useState<BareTicker>('AAPL');
  const [usdAmount, setUsdAmount] = useState('5');
  const [order, setOrder] = useState<UltraOrderResponse | null>(null);
  const [execResult, setExecResult] = useState<UltraExecuteResponse | null>(null);
  const [loading, setLoading] = useState<'quote' | 'exec' | null>(null);

  const meta = XSTOCKS[ticker];
  const mint = meta.mint;
  const mintReady = mint.length > 0;

  async function handleQuote() {
    if (!publicKey) return;
    if (!mintReady) {
      toast.error(
        `${meta.symbol} mint not yet verified — run \`pnpm --filter @signaldesk/ws-server verify:xstocks\` and paste into constants.ts.`,
      );
      return;
    }
    const amount = Math.round(Number(usdAmount) * 10 ** USDC_DECIMALS).toString();
    if (!Number.isFinite(Number(usdAmount)) || Number(usdAmount) <= 0) {
      toast.error('Enter a positive USD amount');
      return;
    }
    setLoading('quote');
    setOrder(null);
    setExecResult(null);
    try {
      const ord = await requestUltraOrder({
        inputMint: USDC_MINT,
        outputMint: mint,
        amount,
        taker: publicKey.toBase58(),
      });
      setOrder(ord);
      toast.success(`Quote: ${ord.inAmount} USDC → ${ord.outAmount} ${meta.symbol}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleExecute() {
    if (!order || !signTransaction) return;
    setLoading('exec');
    try {
      const txBytes = fromBase64(order.transaction);
      const tx = VersionedTransaction.deserialize(txBytes);
      const signed = await signTransaction(tx);
      const signedBase64 = toBase64(signed.serialize());
      const exec = await executeUltraOrder({
        requestId: order.requestId,
        signedTransaction: signedBase64,
      });
      setExecResult(exec);
      if (exec.status === 'Success') {
        toast.success(`Swap confirmed: ${exec.signature ?? '(no sig)'}`);
      } else {
        toast.error(`Swap failed: ${exec.error ?? 'unknown'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>
        ← Home
      </Link>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: '16px 0 8px' }}>/debug/trade</h1>
      <p style={{ color: 'var(--color-fg-muted)', marginBottom: 24 }}>
        Hit Jupiter Ultra with a hardcoded USDC → xStock swap. Gas is sponsored.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>Wallet</div>
            <div style={{ fontSize: 14 }}>
              {connected && publicKey ? publicKey.toBase58() : 'not connected'}
            </div>
          </div>
          <WalletButton />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>Ticker</span>
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value as BareTicker)}
              style={{
                padding: 10,
                borderRadius: 8,
                background: 'var(--color-bg-muted)',
                color: 'var(--color-fg)',
                border: '1px solid var(--color-border)',
              }}
            >
              {BARE_TICKERS.map((t) => {
                const m = XSTOCKS[t];
                return (
                  <option key={t} value={t}>
                    {m.symbol} — {m.name} {m.mint ? '✓' : '⚠'}
                  </option>
                );
              })}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>Amount (USDC)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={usdAmount}
              onChange={(e) => setUsdAmount(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 8,
                background: 'var(--color-bg-muted)',
                color: 'var(--color-fg)',
                border: '1px solid var(--color-border)',
              }}
            />
          </label>
        </div>
        {mintReady ? (
          <div style={{ fontSize: 12, color: 'var(--color-buy)', marginBottom: 12 }}>
            ✓ Verified mint{' '}
            <a
              href={solscanTokenUrl(mint)}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-accent)' }}
            >
              {mint.slice(0, 6)}…{mint.slice(-4)}
            </a>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--color-warn)', marginBottom: 12 }}>
            ⚠ {meta.symbol} mint is empty. Run{' '}
            <code>pnpm --filter @signaldesk/ws-server verify:xstocks</code> and paste the result
            into <code>packages/shared/src/constants.ts</code>.
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn btn-primary"
            disabled={!connected || loading !== null}
            onClick={handleQuote}
          >
            {loading === 'quote' ? 'Fetching quote…' : '1. Get Ultra quote'}
          </button>
          <button
            className="btn btn-buy"
            disabled={!order || loading !== null || !signTransaction}
            onClick={handleExecute}
          >
            {loading === 'exec' ? 'Executing…' : '2. Sign & execute'}
          </button>
        </div>
      </div>

      {order && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--color-fg-muted)', marginBottom: 6 }}>
            Order
          </div>
          <pre
            style={{
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: 'var(--color-fg-muted)',
            }}
          >
            {JSON.stringify(
              {
                requestId: order.requestId,
                inAmount: order.inAmount,
                outAmount: order.outAmount,
                priceImpactPct: order.priceImpactPct,
                swapUsdValue: order.swapUsdValue,
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}

      {execResult && (
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--color-fg-muted)', marginBottom: 6 }}>
            Execution
          </div>
          <pre
            style={{
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: 'var(--color-fg-muted)',
            }}
          >
            {JSON.stringify(execResult, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}
