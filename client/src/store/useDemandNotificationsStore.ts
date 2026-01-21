// src/store/useDemandNotificationsStore.ts
'use client';

import { create } from 'zustand';

interface DemandNotificationsState {
  mesDemandesCount: number;
  setMesDemandesCount: (count: number) => void;
}

export const useDemandNotificationsStore = create<DemandNotificationsState>((set) => ({
  mesDemandesCount: 0,
  setMesDemandesCount: (count: number) => set({ mesDemandesCount: count }),
}));

