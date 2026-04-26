'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Signal } from '@hunch-it/shared';
import { useSharedWorker } from '@/lib/shared-worker/use-shared-worker';
import { useSignalsStore } from '@/lib/store/signals';
import { setAlertFavicon, clearAlertFavicon } from './favicon-dot';
import { startTitleFlash, stopTitleFlash } from './tab-title-flasher';
import { playSignalSound } from './sound-manager';

/**
 * Central client component mounted once in the root layout via <Providers>.
 * Receives signals from the Shared Worker, routes them according to tab state,
 * and owns all "attention-getting" side effects (title/favicon/sound/OS notif).
 */
export function NotificationClient() {
  const router = useRouter();
  const addSignal = useSignalsStore((s) => s.addSignal);
  const activeNotifs = useRef<Map<string, Notification>>(new Map());

  const handleSignal = useCallback(
    (signal: Signal) => {
      addSignal(signal);

      if (typeof document === 'undefined') return;
      const isHidden = document.hidden;

      if (!isHidden) {
        // In-app toast + route to the signal modal on click.
        toast(`${signal.action} ${signal.ticker}`, {
          description: signal.rationale.slice(0, 140),
          action: {
            label: 'Review',
            onClick: () => router.push(`/signals/${signal.id}`),
          },
          duration: Math.min(signal.ttlSeconds * 1000, 30_000),
        });
        // For HOLD we don't push-fullscreen, but BUY/SELL take over.
        if (signal.action !== 'HOLD') {
          router.push(`/signals/${signal.id}`);
        }
        return;
      }

      // Hidden tab: system notification + attention UI.
      startTitleFlash(`🔔 ${signal.action} ${signal.ticker} — Hunch It`);
      setAlertFavicon();
      playSignalSound();

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification(`Hunch It · ${signal.action} ${signal.ticker}`, {
            body: signal.rationale.slice(0, 200),
            tag: signal.id,
            requireInteraction: true,
            icon: '/favicons/signal.png',
          });
          activeNotifs.current.set(signal.id, n);
          n.onclick = () => {
            window.focus();
            router.push(`/signals/${signal.id}`);
            n.close();
            activeNotifs.current.delete(signal.id);
          };
          n.onclose = () => {
            activeNotifs.current.delete(signal.id);
          };
        } catch (err) {
          console.warn('[notifications] Notification() failed', err);
        }
      }
    },
    [addSignal, router],
  );

  useSharedWorker({ onSignal: handleSignal });

  // Stop attention UI + close stale OS notifications when the user returns.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) return;
      stopTitleFlash();
      clearAlertFavicon();
      for (const n of activeNotifs.current.values()) {
        try {
          n.close();
        } catch {
          /* noop */
        }
      }
      activeNotifs.current.clear();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, []);

  return null;
}
