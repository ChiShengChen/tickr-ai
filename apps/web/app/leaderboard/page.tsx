'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface AgentStats {
  totalEvaluated: number;
  wins: number;
  losses: number;
  neutrals: number;
  winRate: number;
  avgPctMove: number;
}
interface LeaderEntry {
  walletAddress: string;
  realizedPnl: number;
  trades: number;
  approvalsYes: number;
  approvalsNo: number;
  approvalsCorrect: number;
  approvalsEvaluated: number;
  approvalAccuracy: number | null;
}
interface LeaderboardResponse {
  agent: AgentStats;
  board: LeaderEntry[];
}

function shorten(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function LeaderboardPage() {
  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const r = await fetch('/api/leaderboard?limit=20');
      if (!r.ok) throw new Error(`leaderboard failed: ${r.status}`);
      return (await r.json()) as LeaderboardResponse;
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
        Agent prediction track record + per-user approval accuracy. Outcomes are graded 1 hour
        after each signal using Pyth Benchmarks.
      </p>

      <AgentBanner stats={data?.agent} loading={isLoading} />

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-muted)', textAlign: 'left' }}>
              <Th>#</Th>
              <Th>Wallet</Th>
              <Th align="right">Realised P&amp;L</Th>
              <Th align="right">Trades</Th>
              <Th align="right">Yes / No</Th>
              <Th align="right">Approval accuracy</Th>
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
                  {row.approvalAccuracy == null ? (
                    <span style={{ color: 'var(--color-fg-muted)' }}>—</span>
                  ) : (
                    <span>
                      {(row.approvalAccuracy * 100).toFixed(0)}%{' '}
                      <span style={{ color: 'var(--color-fg-muted)', fontSize: 12 }}>
                        ({row.approvalsCorrect}/{row.approvalsEvaluated})
                      </span>
                    </span>
                  )}
                </Td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function AgentBanner({ stats, loading }: { stats?: AgentStats; loading: boolean }) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'linear-gradient(135deg, rgba(124,92,255,0.12), rgba(124,92,255,0.02))',
        border: '1px solid rgba(124,92,255,0.35)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-fg-muted)', letterSpacing: '0.06em' }}>
            AGENT · claude-haiku-4-5
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>SignalDesk core</div>
          <div style={{ fontSize: 13, color: 'var(--color-fg-muted)', marginTop: 4 }}>
            Each signal is graded 1 h after creation against the Pyth Benchmarks 5-min close. Win = price
            moved in the predicted direction by &gt; 0.1 %. NEUTRAL excluded from win-rate.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Stat label="Win rate" value={stats ? `${(stats.winRate * 100).toFixed(1)}%` : '—'} loading={loading} accent />
          <Stat label="Wins" value={stats ? `${stats.wins}` : '—'} loading={loading} color="var(--color-buy)" />
          <Stat label="Losses" value={stats ? `${stats.losses}` : '—'} loading={loading} color="var(--color-sell)" />
          <Stat label="Neutral" value={stats ? `${stats.neutrals}` : '—'} loading={loading} />
          <Stat
            label="Avg |Δ|"
            value={stats ? `${(stats.avgPctMove * 100).toFixed(2)}%` : '—'}
            loading={loading}
          />
        </div>
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  loading,
  color,
  accent,
}: {
  label: string;
  value: string;
  loading: boolean;
  color?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--color-bg-muted)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 88,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: accent ? 22 : 18,
          fontWeight: 700,
          color: loading ? 'var(--color-fg-muted)' : (color ?? 'var(--color-fg)'),
          marginTop: 2,
        }}
      >
        {loading ? '—' : value}
      </div>
    </div>
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
    <td colSpan={colSpan} style={{ textAlign: align ?? 'left', padding: '12px 14px', ...style }}>
      {children}
    </td>
  );
}
