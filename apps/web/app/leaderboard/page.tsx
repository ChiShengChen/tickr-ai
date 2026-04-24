import Link from 'next/link';

// TODO: meta-game tracking agent P&L + per-user approval accuracy.
export default function LeaderboardPage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>
        ← Home
      </Link>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: '16px 0 24px' }}>Leaderboard</h1>
      <div className="card">
        <p style={{ color: 'var(--color-fg-muted)' }}>
          Agents will be scored on realised P&amp;L and their follower approval accuracy. Not
          implemented in this bootstrap.
        </p>
      </div>
    </main>
  );
}
