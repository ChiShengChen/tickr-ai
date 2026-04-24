'use client';

import { create } from 'zustand';

interface WalletUiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useWalletUiStore = create<WalletUiState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
