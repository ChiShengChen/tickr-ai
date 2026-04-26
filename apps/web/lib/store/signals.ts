'use client';

import { create } from 'zustand';
import type { Signal } from '@hunch-it/shared';

interface SignalsState {
  signalsById: Record<string, Signal>;
  order: string[];
  addSignal: (signal: Signal) => void;
  removeSignal: (id: string) => void;
  clearExpired: () => void;
}

export const useSignalsStore = create<SignalsState>((set) => ({
  signalsById: {},
  order: [],
  addSignal: (signal) =>
    set((state) => {
      if (state.signalsById[signal.id]) return state;
      return {
        signalsById: { ...state.signalsById, [signal.id]: signal },
        order: [signal.id, ...state.order].slice(0, 50),
      };
    }),
  removeSignal: (id) =>
    set((state) => {
      if (!state.signalsById[id]) return state;
      const next = { ...state.signalsById };
      delete next[id];
      return { signalsById: next, order: state.order.filter((x) => x !== id) };
    }),
  clearExpired: () =>
    set((state) => {
      const now = Date.now();
      const next: Record<string, Signal> = {};
      const order: string[] = [];
      for (const id of state.order) {
        const s = state.signalsById[id];
        if (!s) continue;
        if (new Date(s.expiresAt).getTime() > now) {
          next[id] = s;
          order.push(id);
        }
      }
      return { signalsById: next, order };
    }),
}));
