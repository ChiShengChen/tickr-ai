'use client';

import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  USDC_DECIMALS,
  USDC_MINT,
} from '@signaldesk/shared';
import {
  executeUltraOrder,
  requestUltraOrder,
  type UltraExecuteResponse,
  type UltraOrderResponse,
} from '@/lib/jupiter';

function toBase64(bytes: Uint8Array): string {
  if (typeof window === 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return window.btoa(binary);
}
function fromBase64(str: string): Uint8Array {
  if (typeof window === 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
  const binary = window.atob(str);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

export interface SwapResult {
  order: UltraOrderResponse;
  exec: UltraExecuteResponse;
  inputMint: string;
  outputMint: string;
  /** Token-units of the input asset that were sent. */
  inputAmount: string;
  /** Token-units of the output asset that should arrive. */
  outputAmount: string;
}

export type SwapDirection = 'BUY' | 'SELL';

interface BuyArgs {
  direction: 'BUY';
  xStockMint: string;
  xStockDecimals: number;
  /** USD amount of USDC to spend. */
  usdAmount: number;
}
interface SellArgs {
  direction: 'SELL';
  xStockMint: string;
  xStockDecimals: number;
  /** If true, sell the wallet's entire xStock balance. */
  sellAll: true;
}
export type SwapArgs = BuyArgs | SellArgs;

/**
 * Hook that wraps the full Jupiter Ultra round-trip:
 * 1) GET /ultra/v1/order
 * 2) wallet.signTransaction(VersionedTransaction)
 * 3) POST /ultra/v1/execute
 *
 * Used by both the manual `/debug/trade` page and the SignalModal "Yes, Execute"
 * flow so they can't drift.
 */
export function useJupiterSwap() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState<'order' | 'sign' | 'execute' | null>(null);
  const [lastOrder, setLastOrder] = useState<UltraOrderResponse | null>(null);

  const swap = useCallback(
    async (args: SwapArgs): Promise<SwapResult> => {
      if (!publicKey || !signTransaction) throw new Error('Wallet not connected');
      if (!args.xStockMint) throw new Error('xStock mint address is empty');

      let inputMint: string;
      let outputMint: string;
      let amount: string;

      if (args.direction === 'BUY') {
        inputMint = USDC_MINT;
        outputMint = args.xStockMint;
        amount = Math.round(args.usdAmount * 10 ** USDC_DECIMALS).toString();
      } else {
        // SELL: read the wallet's Token-2022 balance for this mint and sell all.
        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: new PublicKey(TOKEN_2022_PROGRAM_ID),
        });
        const found = accounts.value.find((a) => {
          const info = a.account.data;
          if ('parsed' in info && info.parsed?.info?.mint === args.xStockMint) return true;
          return false;
        });
        const raw =
          (found?.account.data as unknown as {
            parsed?: { info?: { tokenAmount?: { amount?: string } } };
          })?.parsed?.info?.tokenAmount?.amount ?? '0';
        if (raw === '0') throw new Error(`No xStock balance for ${args.xStockMint}`);
        inputMint = args.xStockMint;
        outputMint = USDC_MINT;
        amount = raw;
      }

      setLoading('order');
      const order = await requestUltraOrder({
        inputMint,
        outputMint,
        amount,
        taker: publicKey.toBase58(),
      });
      setLastOrder(order);

      setLoading('sign');
      const txBytes = fromBase64(order.transaction);
      const tx = VersionedTransaction.deserialize(txBytes);
      const signed = await signTransaction(tx);

      setLoading('execute');
      const exec = await executeUltraOrder({
        requestId: order.requestId,
        signedTransaction: toBase64(signed.serialize()),
      });

      setLoading(null);
      return {
        order,
        exec,
        inputMint,
        outputMint,
        inputAmount: order.inAmount,
        outputAmount: order.outAmount,
      };
    },
    [connection, publicKey, signTransaction],
  );

  return { swap, loading, lastOrder };
}
