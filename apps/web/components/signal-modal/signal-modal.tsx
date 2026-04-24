'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import type { Signal } from '@signaldesk/shared';
import { useSharedWorker } from '@/lib/shared-worker/use-shared-worker';

interface SignalModalProps {
  signal: Signal | null;
  fallbackId?: string;
  onClose: (decision: boolean | null) => void;
}

function ttlColor(ratio: number): string {
  if (ratio > 0.5) return 'var(--color-buy)';
  if (ratio > 0.2) return 'var(--color-warn)';
  return 'var(--color-sell)';
}

export function SignalModal({ signal, fallbackId, onClose }: SignalModalProps) {
  const { publicKey } = useWallet();
  const { sendApproval } = useSharedWorker();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const { secondsLeft, ratio } = useMemo(() => {
    if (!signal) return { secondsLeft: 0, ratio: 0 };
    const total = signal.ttlSeconds * 1000;
    const remain = new Date(signal.expiresAt).getTime() - now;
    const r = Math.max(0, Math.min(1, remain / total));
    return { secondsLeft: Math.max(0, Math.ceil(remain / 1000)), ratio: r };
  }, [signal, now]);

  useEffect(() => {
    if (!signal) return;
    if (secondsLeft <= 0) {
      submit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, signal?.id]);

  function submit(decision: boolean) {
    if (!signal) {
      onClose(null);
      return;
    }
    if (!publicKey) {
      toast.error('Connect a wallet to approve signals');
      return;
    }
    sendApproval({
      signalId: signal.id,
      walletAddress: publicKey.toBase58(),
      decision,
    });
    if (decision) {
      toast.success(`Executing ${signal.action} ${signal.ticker}… (stubbed — wire Jupiter here)`);
    } else {
      toast('Signal skipped');
    }
    onClose(decision);
  }

  if (!signal) {
    return (
      <div style={overlayStyle}>
        <div className="card" style={{ maxWidth: 420 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Signal not found</h2>
          <p style={{ color: 'var(--color-fg-muted)', marginBottom: 16 }}>
            {fallbackId ? (
              <>
                This signal has expired or wasn't received by this tab:{' '}
                <code style={{ fontSize: 12 }}>{fallbackId}</code>.
              </>
            ) : (
              <>No signal id provided.</>
            )}
          </p>
          <button className="btn btn-ghost" onClick={() => onClose(null)}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const actionClass =
    signal.action === 'BUY' ? 'badge-buy' : signal.action === 'SELL' ? 'badge-sell' : 'badge-hold';

  return (
    <div style={overlayStyle}>
      <div
        className="card"
        style={{
          width: 'min(640px, 92vw)',
          padding: '32px 32px 24px',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-fg-muted)', marginBottom: 6 }}>
              {signal.degraded ? 'RULE FALLBACK' : 'AI SIGNAL'} · conf{' '}
              {(signal.confidence * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {signal.ticker}
            </div>
            <div style={{ marginTop: 6 }}>
              <span className={`badge ${actionClass}`}>{signal.action}</span>
            </div>
          </div>

          <TtlRing ratio={ratio} seconds={secondsLeft} />
        </div>

        <div
          style={{
            background: 'var(--color-bg-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: 14,
            fontSize: 14,
            color: 'var(--color-fg-muted)',
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          {signal.rationale}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          <Stat label="Signal price" value={`$${signal.priceAtSignal.toFixed(2)}`} />
          <Stat label="RSI(14)" value={signal.indicators.rsi?.toFixed(1) ?? 'n/a'} />
          <Stat
            label="MACD hist"
            value={signal.indicators.macd?.histogram.toFixed(2) ?? 'n/a'}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, padding: '16px 24px', fontSize: 16 }}
            onClick={() => submit(false)}
          >
            No, skip
          </button>
          <button
            className={signal.action === 'SELL' ? 'btn btn-sell' : 'btn btn-buy'}
            style={{ flex: 2, padding: '16px 24px', fontSize: 16 }}
            onClick={() => submit(true)}
          >
            Yes, execute {signal.action}
          </button>
        </div>
      </div>
    </div>
  );
}

function TtlRing({ ratio, seconds }: { ratio: number; seconds: number }) {
  const size = 88;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * ratio;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-border)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ttlColor(ratio)}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke 200ms linear, stroke-dasharray 200ms linear' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: 20,
          color: ttlColor(ratio),
        }}
      >
        {seconds}s
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--color-bg-muted)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div style={{ color: 'var(--color-fg-muted)', fontSize: 12, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(5, 6, 10, 0.72)',
  backdropFilter: 'blur(6px)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 9999,
  padding: 24,
};
