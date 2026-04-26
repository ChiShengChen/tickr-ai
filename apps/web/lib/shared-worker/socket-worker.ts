/// <reference lib="webworker" />
/**
 * Shared Worker — one Socket.IO connection shared across every open tab.
 *
 * - Connects to `NEXT_PUBLIC_WS_URL` and listens for `signal:new`.
 * - Fans out inbound events to all tabs via `broadcast-channel`.
 * - Accepts outbound messages from tabs via MessagePort and forwards them
 *   to the server (e.g. approval decisions).
 * - Exponential-backoff reconnect driven by socket.io-client internals.
 */

import { BroadcastChannel } from 'broadcast-channel';
import { io, type Socket } from 'socket.io-client';
import {
  WsClientEvents,
  WsServerEvents,
  type ApprovalDecisionPayload,
  type Signal,
} from '@hunch-it/shared';

export const BROADCAST_CHANNEL = 'hunch-it';

export type TabToWorker =
  | { type: 'hello' }
  | { type: 'approval'; payload: ApprovalDecisionPayload };

export type WorkerToTab =
  | { type: 'connected' }
  | { type: 'disconnected'; reason: string }
  | { type: 'signal:new'; signal: Signal };

// NOTE: SharedWorker code runs in its own global. `self` here refers to the
// SharedWorkerGlobalScope, which TypeScript's default lib doesn't know about.
// We narrow via `unknown` to avoid `any`.
interface SharedWorkerLikeScope {
  onconnect: ((ev: MessageEvent) => void) | null;
}
const scope = self as unknown as SharedWorkerLikeScope;

const WS_URL =
  (globalThis as unknown as { __WS_URL__?: string }).__WS_URL__ ??
  'http://localhost:4000';

const channel = new BroadcastChannel<WorkerToTab>(BROADCAST_CHANNEL);
const ports = new Set<MessagePort>();

const socket: Socket = io(WS_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 10_000,
});

function broadcast(msg: WorkerToTab): void {
  void channel.postMessage(msg);
  for (const p of ports) {
    try {
      p.postMessage(msg);
    } catch {
      ports.delete(p);
    }
  }
}

socket.on('connect', () => broadcast({ type: 'connected' }));
socket.on('disconnect', (reason) =>
  broadcast({ type: 'disconnected', reason: String(reason) }),
);
socket.on(WsServerEvents.SignalNew, (signal: Signal) => {
  broadcast({ type: 'signal:new', signal });
});

scope.onconnect = (event: MessageEvent) => {
  const port = (event as unknown as { ports: MessagePort[] }).ports[0];
  if (!port) return;
  ports.add(port);

  port.addEventListener('message', (ev: MessageEvent<TabToWorker>) => {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'approval') {
      socket.emit(WsClientEvents.ApprovalDecision, msg.payload);
    }
  });
  port.start();

  // Greet the tab with current connection state so the UI can render quickly.
  port.postMessage(
    socket.connected
      ? ({ type: 'connected' } satisfies WorkerToTab)
      : ({ type: 'disconnected', reason: 'pending' } satisfies WorkerToTab),
  );
};
