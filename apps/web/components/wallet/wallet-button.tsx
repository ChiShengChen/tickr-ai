'use client';

import dynamic from 'next/dynamic';

// wallet-adapter-react-ui uses browser APIs; load client-side only.
const WalletMultiButtonDynamic = dynamic(
  () =>
    import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false, loading: () => <button className="btn btn-ghost">Connect</button> },
);

export function WalletButton() {
  return <WalletMultiButtonDynamic />;
}
