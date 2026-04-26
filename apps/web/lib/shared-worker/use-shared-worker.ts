'use client';

import { BroadcastChannel } from 'broadcast-channel';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  WsClientEvents,
  WsServerEvents,
  type ApprovalDecisionPayload,
  type Signal,
} from '@hunch-it/shared';

export const BROADCAST_CHANNEL = 'hunch-it';

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
 * Attaches the current tab to the Hunch It Shared Worker and subscribes to
 * signal broadcasts. Falls back gracefully in browsers without SharedWorker by
 * still listening to the broadcast-channel (which other tabs / extensions may
 * post to).
 */
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

export function useSharedWorker(opts: UseSharedWorkerOptions = {}): UseSharedWorkerReturn {
  const [connected, setConnected] = useState(false);
  const portRef = useRef<MessagePort | null>(null);
  const directSocketRef = useRef<Socket | null>(null);
  const onSignalRef = useRef<((s: Signal) => void) | undefined>(opts.onSignal);
  onSignalRef.current = opts.onSignal;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleMessage(msg: WorkerToTab) {
      if (!msg) return;
      if (msg.type === 'connected') setConnected(true);
      else if (msg.type === 'disconnected') setConnected(false);
      else if (msg.type === 'signal:new') onSignalRef.current?.(msg.signal);
    }

    // We previously tried `new SharedWorker(new URL('./socket-worker.ts', ...))`
    // for cross-tab dedup, but Turbopack in Next.js 15 dev doesn't bundle the
    // worker script — the constructor succeeds but the script load fails async
    // ('Failed to fetch a worker script.'), and the error doesn't reach our
    // try/catch. For now we always go direct Socket.IO. Cross-tab dedup is a
    // production polish item.
    const channel = new BroadcastChannel<WorkerToTab>(BROADCAST_CHANNEL);
    channel.addEventListener('message', handleMessage);

    console.info(`[ws] opening direct Socket.IO to ${WS_URL}`);
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
    directSocketRef.current = socket;
    socket.on('connect', () => {
      console.info('[ws] direct socket connected', socket.id);
      setConnected(true);
    });
    socket.on('disconnect', (reason) => {
      console.info('[ws] direct socket disconnected', reason);
      setConnected(false);
    });
    socket.on(WsServerEvents.SignalNew, (signal: Signal) => {
      onSignalRef.current?.(signal);
    });

    return () => {
      channel.removeEventListener('message', handleMessage);
      void channel.close();
      if (directSocketRef.current) {
        directSocketRef.current.disconnect();
        directSocketRef.current = null;
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
    if (directSocketRef.current) {
      directSocketRef.current.emit(WsClientEvents.ApprovalDecision, payload);
      return;
    }
    // Last resort: hit the Next API route.
    void fetch('/api/approvals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  return { connected, sendApproval };
}
