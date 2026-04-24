import Link from 'next/link';

// TODO: wire to /api/portfolio + positions table.
export default function PortfolioPage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>
        ← Home
      </Link>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: '16px 0 24px' }}>Portfolio</h1>
      <div className="card">
        <p style={{ color: 'var(--color-fg-muted)' }}>
          Positions, realized/unrealized P&amp;L, and trade history will live here. Not implemented
          in this bootstrap.
        </p>
      </div>
    </main>
  );
}
