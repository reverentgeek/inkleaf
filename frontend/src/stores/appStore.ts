import { create } from "zustand";
import type { Note, VaultNote } from "../api/client";

interface AppState {
  // Notes
  notes: Note[];
  setNotes: (notes: Note[]) => void;
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;

  // Vault
  vaultNotes: VaultNote[];
  setVaultNotes: (notes: VaultNote[]) => void;
  isVaultMode: boolean;
  toggleVaultMode: () => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  commandPaletteMode: "text" | "semantic";
  setCommandPaletteMode: (mode: "text" | "semantic") => void;
  openCommandPalette: (mode: "text" | "semantic") => void;
  viewMode: "edit" | "preview";
  setViewMode: (mode: "edit" | "preview") => void;

  // Notebooks
  activeNotebook: string | null;
  setActiveNotebook: (notebook: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  notes: [],
  setNotes: (notes) => set({ notes }),
  activeNoteId: null,
  setActiveNoteId: (id) => set({ activeNoteId: id }),

  vaultNotes: [],
  setVaultNotes: (notes) => set({ vaultNotes: notes }),
  isVaultMode: false,
  toggleVaultMode: () => set((s) => ({ isVaultMode: !s.isVaultMode, activeNoteId: null })),

  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  commandPaletteMode: "text",
  setCommandPaletteMode: (mode) => set({ commandPaletteMode: mode }),
  openCommandPalette: (mode) => set({ commandPaletteOpen: true, commandPaletteMode: mode }),

  viewMode: "edit",
  setViewMode: (mode) => set({ viewMode: mode }),

  activeNotebook: null,
  setActiveNotebook: (notebook) => set({ activeNotebook: notebook }),
}));
