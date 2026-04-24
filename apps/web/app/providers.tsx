'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, type ReactNode } from 'react';
import { WalletContextProvider } from '@/components/wallet/wallet-provider';
import { NotificationClient } from '@/components/notifications/notification-client';

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={qc}>
      <WalletContextProvider>
        {children}
        <NotificationClient />
        <Toaster theme="dark" position="top-right" richColors />
      </WalletContextProvider>
    </QueryClientProvider>
  );
}
