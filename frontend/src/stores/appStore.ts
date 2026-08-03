import { create } from "zustand";
import type { Note, SyncStatus } from "../api/client";

type Theme = "light" | "dark";

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AppState {
  // Notes
  notes: Note[];
  setNotes: (notes: Note[]) => void;
  trashNotes: Note[];
  setTrashNotes: (notes: Note[]) => void;
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;

  // Sidebar view: active notes vs. trash
  sidebarView: "notes" | "trash";
  setSidebarView: (view: "notes" | "trash") => void;

  // Transient toast (e.g. undo after delete)
  toast: Toast | null;
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: () => void;

  // UI
  theme: Theme;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  viewMode: "edit" | "preview";
  setViewMode: (mode: "edit" | "preview") => void;

  // Tag navigation
  activeTag: string | null;
  setActiveTag: (tag: string | null) => void;
  expandedTagPaths: string[];
  toggleTagExpanded: (path: string) => void;
  tagsSectionOpen: boolean;
  toggleTagsSection: () => void;

  // Sync status (null until the first poll completes)
  syncStatus: SyncStatus | null;
  setSyncStatus: (status: SyncStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  notes: [],
  setNotes: (notes) => set({ notes }),
  trashNotes: [],
  setTrashNotes: (trashNotes) => set({ trashNotes }),

  sidebarView: "notes",
  setSidebarView: (sidebarView) => set({ sidebarView }),

  toast: null,
  showToast: (toast) => set({ toast: { ...toast, id: Date.now() } }),
  dismissToast: () => set({ toast: null }),

  activeNoteId: localStorage.getItem("inkleaf-active-note"),
  setActiveNoteId: (id) => {
    if (id) localStorage.setItem("inkleaf-active-note", id);
    else localStorage.removeItem("inkleaf-active-note");
    set({ activeNoteId: id });
  },

  theme: (localStorage.getItem("inkleaf-theme") as Theme) || "dark",
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      localStorage.setItem("inkleaf-theme", next);
      return { theme: next };
    }),

  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  viewMode: "edit",
  setViewMode: (mode) => set({ viewMode: mode }),

  activeTag: localStorage.getItem("inkleaf-active-tag"),
  setActiveTag: (tag) => {
    if (tag) localStorage.setItem("inkleaf-active-tag", tag);
    else localStorage.removeItem("inkleaf-active-tag");
    localStorage.removeItem("inkleaf-active-note");
    set({ activeTag: tag, activeNoteId: null });
  },
  expandedTagPaths: JSON.parse(localStorage.getItem("inkleaf-expanded-tags") || "[]"),
  toggleTagExpanded: (path) =>
    set((s) => {
      const next = s.expandedTagPaths.includes(path)
        ? s.expandedTagPaths.filter((p) => p !== path)
        : [...s.expandedTagPaths, path];
      localStorage.setItem("inkleaf-expanded-tags", JSON.stringify(next));
      return { expandedTagPaths: next };
    }),
  tagsSectionOpen: localStorage.getItem("inkleaf-tags-open") !== "false",
  toggleTagsSection: () =>
    set((s) => {
      const next = !s.tagsSectionOpen;
      localStorage.setItem("inkleaf-tags-open", String(next));
      return { tagsSectionOpen: next };
    }),

  syncStatus: null,
  setSyncStatus: (status) => set({ syncStatus: status }),
}));
