'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface LeaderEntry {
  walletAddress: string;
  realizedPnl: number;
  trades: number;
  approvalsYes: number;
  approvalsNo: number;
  approvalAccuracy: number | null;
}

function shorten(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function LeaderboardPage() {
  const { data, isLoading } = useQuery<{ board: LeaderEntry[] }>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const r = await fetch('/api/leaderboard?limit=20');
      if (!r.ok) throw new Error(`leaderboard failed: ${r.status}`);
      return (await r.json()) as { board: LeaderEntry[] };
    },
    refetchInterval: 30_000,
  });

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>
        ← Home
      </Link>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: '16px 0 8px' }}>Leaderboard</h1>
      <p style={{ color: 'var(--color-fg-muted)', marginBottom: 24 }}>
        Top approvers by realised P&amp;L. Accuracy = winning SELL trades / total SELL trades.
      </p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-muted)', textAlign: 'left' }}>
              <Th>#</Th>
              <Th>Wallet</Th>
              <Th align="right">Realised P&amp;L</Th>
              <Th align="right">Trades</Th>
              <Th align="right">Yes / No</Th>
              <Th align="right">Accuracy</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <Td colSpan={6} style={{ color: 'var(--color-fg-muted)' }}>
                  Loading…
                </Td>
              </tr>
            )}
            {!isLoading && (data?.board.length ?? 0) === 0 && (
              <tr>
                <Td colSpan={6} style={{ color: 'var(--color-fg-muted)' }}>
                  No approvers yet. Be the first.
                </Td>
              </tr>
            )}
            {data?.board.map((row, i) => (
              <motion.tr
                key={row.walletAddress}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025, duration: 0.2 }}
                style={{ borderTop: '1px solid var(--color-border)' }}
              >
                <Td>{i + 1}</Td>
                <Td>
                  <code style={{ fontSize: 12 }}>{shorten(row.walletAddress)}</code>
                </Td>
                <Td
                  align="right"
                  style={{ color: row.realizedPnl >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' }}
                >
                  ${row.realizedPnl.toFixed(2)}
                </Td>
                <Td align="right">{row.trades}</Td>
                <Td align="right">
                  {row.approvalsYes} / {row.approvalsNo}
                </Td>
                <Td align="right">
                  {row.approvalAccuracy == null
                    ? '—'
                    : `${(row.approvalAccuracy * 100).toFixed(0)}%`}
                </Td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      style={{
        textAlign: align ?? 'left',
        padding: '10px 14px',
        fontSize: 12,
        color: 'var(--color-fg-muted)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  colSpan,
  style,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  colSpan?: number;
  style?: React.CSSProperties;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align ?? 'left',
        padding: '12px 14px',
        ...style,
      }}
    >
      {children}
    </td>
  );
}
