'use client';

import { motion, type Variants } from 'framer-motion';
import Link from 'next/link';
import { WalletButton } from '@/components/wallet/wallet-button';
import { isDemo } from '@/lib/demo';

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '64px 24px',
        maxWidth: 1040,
        margin: '0 auto',
      }}
    >
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 64,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          Hunch It<span style={{ color: 'var(--color-accent)' }}>.</span>
          {isDemo() && (
            <span
              className="badge"
              style={{ background: 'rgba(245,158,11,0.18)', color: 'var(--color-warn)' }}
            >
              DEMO
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/portfolio" className="btn btn-ghost">
            Portfolio
          </Link>
          <Link href="/leaderboard" className="btn btn-ghost">
            Leaderboard
          </Link>
          <Link href="/debug/trade" className="btn btn-ghost">
            /debug/trade
          </Link>
          <WalletButton />
        </div>
      </nav>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ marginBottom: 48 }}
      >
        <h1
          style={{
            fontSize: 64,
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 16,
          }}
        >
          AI trading signals for
          <br />
          <span style={{ color: 'var(--color-accent)' }}>tokenized US stocks.</span>
        </h1>
        <p style={{ fontSize: 18, color: 'var(--color-fg-muted)', maxWidth: 640 }}>
          Leave Hunch It running in a background tab. Our signal engine watches xStocks on Pyth
          and pings you with a 30-second window to approve a Jupiter Ultra swap — gas sponsored.
        </p>
      </motion.section>

      <motion.section
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
        }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}
      >
        <motion.div variants={cardVariants}>
          <Link
            href="/onboarding"
            className="card"
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div style={{ color: 'var(--color-accent)', fontSize: 13, marginBottom: 8 }}>
              STEP 1 · 2 MIN
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Connect & onboard</div>
            <div style={{ color: 'var(--color-fg-muted)', fontSize: 14 }}>
              Phantom / Solflare / Backpack, notification permission, sound unlock.
            </div>
          </Link>
        </motion.div>
        <motion.div className="card" variants={cardVariants}>
          <div style={{ color: 'var(--color-fg-muted)', fontSize: 13, marginBottom: 8 }}>
            STEP 2 · PASSIVE
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Leave a tab open</div>
          <div style={{ color: 'var(--color-fg-muted)', fontSize: 14 }}>
            A Shared Worker keeps one socket alive across every tab.
          </div>
        </motion.div>
        <motion.div className="card" variants={cardVariants}>
          <div style={{ color: 'var(--color-fg-muted)', fontSize: 13, marginBottom: 8 }}>
            STEP 3 · ON SIGNAL
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Approve in 30s</div>
          <div style={{ color: 'var(--color-fg-muted)', fontSize: 14 }}>
            System notification → modal with Yes / No. Click Yes, sign, done.
          </div>
        </motion.div>
      </motion.section>
    </main>
  );
}
