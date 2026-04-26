'use client';

import { useMemo, type ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// Privy v2 throws on empty appId; use a sentinel so the provider still mounts
// (it will just stay `ready: false` until a real id is supplied).
const PRIVY_APP_ID =
  process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.NEXT_PUBLIC_PRIVY_APP_ID.length > 0
    ? process.env.NEXT_PUBLIC_PRIVY_APP_ID
    : 'cm-tickrai-placeholder';

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL && process.env.NEXT_PUBLIC_SOLANA_RPC_URL.length > 0
        ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL
        : clusterApiUrl(WalletAdapterNetwork.Mainnet),
    [],
  );

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google', 'apple', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#7c5cff',
          walletChainType: 'solana-only',
        },
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' },
        },
        solanaClusters: [{ name: 'mainnet-beta', rpcUrl: endpoint }],
      }}
    >
      <ConnectionProvider endpoint={endpoint}>{children}</ConnectionProvider>
    </PrivyProvider>
  );
}
