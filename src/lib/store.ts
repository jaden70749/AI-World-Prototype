import { create } from 'zustand';

export const brokenBlocks = new Set<string>();
export const placedBlocks = new Map<string, string>();

export function isBlockBroken(x: number, y: number, z: number) {
  return brokenBlocks.has(`${x}_${y}_${z}`);
}

export function getPlacedBlock(x: number, y: number, z: number) {
  return placedBlocks.get(`${x}_${y}_${z}`);
}

export function placeBlock(x: number, y: number, z: number, type: string) {
  placedBlocks.set(`${x}_${y}_${z}`, type);
  // Suppress any natural block that might have been there
  brokenBlocks.add(`${x}_${y}_${z}`);
  window.dispatchEvent(new CustomEvent('block_broken', { detail: { x, y, z } }));
}

export function breakBlock(x: number, y: number, z: number) {
  brokenBlocks.add(`${x}_${y}_${z}`);
  placedBlocks.delete(`${x}_${y}_${z}`);
  window.dispatchEvent(new CustomEvent('block_broken', { detail: { x, y, z } }));
}

interface GameState {
  creativeMode: boolean;
  setCreativeMode: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  inventoryOpen: boolean;
  setInventoryOpen: (v: boolean) => void;
  hotbarIndex: number;
  setHotbarIndex: (v: number) => void;
  miningProgress: number;
  setMiningProgress: (v: number) => void;
  miningTarget: { x: number, y: number, z: number } | null;
  setMiningTarget: (v: { x: number, y: number, z: number } | null) => void;
  renderDistance: number;
  setRenderDistance: (v: number) => void;
  showDebugBounds: boolean;
  setShowDebugBounds: (v: boolean) => void;
  language: string;
  setLanguage: (v: string) => void;
  isUnderwater: boolean;
  setIsUnderwater: (v: boolean) => void;
  inventory: { type: string; count: number }[];
  addToInventory: (type: string, amount?: number) => void;
  removeFromInventory: (type: string, amount?: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  creativeMode: false,
  setCreativeMode: (v) => set({ creativeMode: v }),
  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  inventoryOpen: false,
  setInventoryOpen: (v) => set({ inventoryOpen: v }),
  hotbarIndex: 0,
  setHotbarIndex: (v) => set({ hotbarIndex: v }),
  miningProgress: 0,
  setMiningProgress: (v) => set({ miningProgress: v }),
  miningTarget: null,
  setMiningTarget: (v) => set({ miningTarget: v }),
  renderDistance: 5,
  setRenderDistance: (v) => set({ renderDistance: v }),
  showDebugBounds: false,
  setShowDebugBounds: (v) => set({ showDebugBounds: v }),
  language: 'English',
  setLanguage: (v) => set({ language: v }),
  isUnderwater: false,
  setIsUnderwater: (v) => set({ isUnderwater: v }),
  inventory: Array.from({ length: 36 }).map(() => ({ type: '', count: 0 })),
  addToInventory: (type, amount = 1) => set((state) => {
    const newInv = [...state.inventory];
    // Find existing slot
    const existingIdx = newInv.findIndex(s => s.type === type && s.count < 64);
    if (existingIdx !== -1) {
      newInv[existingIdx] = { ...newInv[existingIdx], count: Math.min(newInv[existingIdx].count + amount, 64) };
    } else {
      // Find empty slot
      const emptyIdx = newInv.findIndex(s => s.count === 0);
      if (emptyIdx !== -1) {
        newInv[emptyIdx] = { type, count: amount };
      }
    }
    return { inventory: newInv };
  }),
  removeFromInventory: (type, amount = 1) => set((state) => {
    const newInv = [...state.inventory];
    const existingIdx = newInv.findIndex(s => s.type === type && s.count > 0);
    if (existingIdx !== -1) {
      const newCount = Math.max(newInv[existingIdx].count - amount, 0);
      newInv[existingIdx] = { type: newCount === 0 ? '' : type, count: newCount };
    }
    return { inventory: newInv };
  }),
}));
