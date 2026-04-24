'use client';

import { BroadcastChannel } from 'broadcast-channel';
import { useEffect, useRef, useState } from 'react';
import type { ApprovalDecisionPayload, Signal } from '@signaldesk/shared';

export const BROADCAST_CHANNEL = 'signaldesk';

type WorkerToTab =
  | { type: 'connected' }
  | { type: 'disconnected'; reason: string }
  | { type: 'signal:new'; signal: Signal };

type TabToWorker =
  | { type: 'hello' }
  | { type: 'approval'; payload: ApprovalDecisionPayload };

interface UseSharedWorkerOptions {
  onSignal?: (signal: Signal) => void;
}

interface UseSharedWorkerReturn {
  connected: boolean;
  sendApproval: (payload: ApprovalDecisionPayload) => void;
}

/**
 * Attaches the current tab to the SignalDesk Shared Worker and subscribes to
 * signal broadcasts. Falls back gracefully in browsers without SharedWorker by
 * still listening to the broadcast-channel (which other tabs / extensions may
 * post to).
 */
export function useSharedWorker(opts: UseSharedWorkerOptions = {}): UseSharedWorkerReturn {
  const [connected, setConnected] = useState(false);
  const portRef = useRef<MessagePort | null>(null);
  const onSignalRef = useRef<((s: Signal) => void) | undefined>(opts.onSignal);
  onSignalRef.current = opts.onSignal;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let worker: SharedWorker | null = null;
    let port: MessagePort | null = null;

    function handleMessage(msg: WorkerToTab) {
      if (!msg) return;
      if (msg.type === 'connected') setConnected(true);
      else if (msg.type === 'disconnected') setConnected(false);
      else if (msg.type === 'signal:new') onSignalRef.current?.(msg.signal);
    }

    if ('SharedWorker' in window) {
      try {
        worker = new SharedWorker(
          new URL('./socket-worker.ts', import.meta.url),
          { type: 'module', name: 'signaldesk-socket' },
        );
        port = worker.port;
        port.start();
        portRef.current = port;
        port.addEventListener('message', (ev: MessageEvent<WorkerToTab>) => {
          handleMessage(ev.data);
        });
        port.postMessage({ type: 'hello' } satisfies TabToWorker);
      } catch (err) {
        console.warn('[shared-worker] failed to start, falling back to BroadcastChannel', err);
      }
    }

    const channel = new BroadcastChannel<WorkerToTab>(BROADCAST_CHANNEL);
    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      void channel.close();
      if (port) {
        try {
          port.close();
        } catch {
          /* noop */
        }
      }
      portRef.current = null;
    };
  }, []);

  function sendApproval(payload: ApprovalDecisionPayload) {
    const port = portRef.current;
    if (port) {
      port.postMessage({ type: 'approval', payload } satisfies TabToWorker);
      return;
    }
    // Fallback: POST directly. Shared Worker unavailable.
    void fetch('/api/approvals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  return { connected, sendApproval };
}
