'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/wallet/use-wallet';

function shorten(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function WalletButton() {
  const { connected, ready, address, login, logout } = useWallet();
  const [open, setOpen] = useState(false);

  if (!ready) {
    return (
      <button className="btn btn-ghost" disabled>
        Loading…
      </button>
    );
  }

  if (!connected || !address) {
    return (
      <button className="btn btn-primary" onClick={login}>
        Connect
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost"
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      >
        {shorten(address)} ▾
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: 6,
            minWidth: 200,
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: '8px 10px',
              fontSize: 11,
              color: 'var(--color-fg-muted)',
              wordBreak: 'break-all',
            }}
          >
            {address}
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => {
              setOpen(false);
              void navigator.clipboard.writeText(address);
            }}
          >
            Copy address
          </button>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
