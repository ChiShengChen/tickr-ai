'use client';

import { useCallback, useMemo } from 'react';
import { PublicKey, type Transaction, type VersionedTransaction } from '@solana/web3.js';
import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';

/**
 * Unified wallet surface across the app — abstracts whether the user signed in
 * via email/social (Privy embedded) or an external wallet (Phantom etc. forwarded
 * through Privy). Mirrors the shape that the rest of the codebase used to import
 * from `@solana/wallet-adapter-react`'s `useWallet`, so call sites mostly stay as-is.
 */
export interface UnifiedWallet {
  publicKey: PublicKey | null;
  address: string | null;
  connected: boolean;
  ready: boolean;
  signTransaction: <T extends VersionedTransaction | Transaction>(tx: T) => Promise<T>;
  login: () => void;
  logout: () => Promise<void>;
}

const SIGN_NOT_AVAILABLE = async <T,>(): Promise<T> => {
  throw new Error('Wallet not connected — call login() first.');
};

export function useWallet(): UnifiedWallet {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useSolanaWallets();
  const wallet = wallets[0]; // first available — embedded wallet wins on email login

  const publicKey = useMemo(() => {
    if (!wallet?.address) return null;
    try {
      return new PublicKey(wallet.address);
    } catch {
      return null;
    }
  }, [wallet?.address]);

  const signTransaction = useCallback(
    async <T extends VersionedTransaction | Transaction>(tx: T): Promise<T> => {
      if (!wallet) throw new Error('No connected wallet');
      // Privy's Solana wallet exposes signTransaction(tx) returning the signed tx.
      // It accepts both legacy Transaction and VersionedTransaction.
      const signed = (await wallet.signTransaction(tx as VersionedTransaction)) as T;
      return signed;
    },
    [wallet],
  );

  return {
    publicKey,
    address: wallet?.address ?? null,
    connected: ready && authenticated && !!wallet,
    ready,
    signTransaction: wallet ? signTransaction : (SIGN_NOT_AVAILABLE as UnifiedWallet['signTransaction']),
    login,
    logout,
  };
}
