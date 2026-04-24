'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SignalModal } from '@/components/signal-modal/signal-modal';
import { useSignalsStore } from '@/lib/store/signals';

export default function SignalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const signal = useSignalsStore((s) => (params?.id ? s.signalsById[params.id] : undefined));
  const removeSignal = useSignalsStore((s) => s.removeSignal);

  // If user hits this URL cold (e.g. via shared link) and the signal isn't in
  // the client store, show a placeholder. TODO: GET /api/signals/:id.
  useEffect(() => {
    if (!params?.id) return;
    return () => {
      /* noop */
    };
  }, [params?.id]);

  function handleClose(decision: boolean | null) {
    if (params?.id) removeSignal(params.id);
    router.replace('/');
    void decision;
  }

  return (
    <SignalModal
      signal={signal ?? null}
      fallbackId={params?.id}
      onClose={handleClose}
    />
  );
}
