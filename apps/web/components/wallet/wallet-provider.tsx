'use client';

import { useMemo, type ReactNode } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL && process.env.NEXT_PUBLIC_SOLANA_RPC_URL.length > 0
        ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL
        : clusterApiUrl(WalletAdapterNetwork.Mainnet),
    [],
  );

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
