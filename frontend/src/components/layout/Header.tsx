import { useState, useEffect, useCallback } from "react";
import { Search, PanelLeftClose, PanelLeft, Sun, Moon, HelpCircle, FileInput, FileOutput } from "lucide-react";
import KeyboardShortcutsDialog from "../KeyboardShortcutsDialog";
import SyncStatusIndicator from "../SyncStatusIndicator";
import { useAppStore } from "../../stores/appStore";
import { useImportExport } from "../../hooks/useImportExport";

const mod = navigator.platform.includes("Mac") ? "⌘" : "Ctrl+";

interface HeaderProps {
  title: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
}

export default function Header({
  title,
  sidebarOpen,
  onToggleSidebar,
  onOpenSearch,
}: HeaderProps) {
  const { theme, toggleTheme } = useAppStore();
  const { importFile, exportActiveNote, canExport } = useImportExport();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Listen for Tauri menu event
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("show-keyboard-shortcuts", () => {
        setShortcutsOpen((prev) => !prev);
      }).then((fn) => {
        unlisten = fn;
      });
    }).catch(() => {
      // Not running in Tauri (browser dev mode)
    });
    return () => unlisten?.();
  }, []);

  return (
    <>
    <header className="flex items-center justify-between px-4 py-2 border-b border-ink-border bg-ink-bg-primary/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded hover:bg-ink-bg-secondary text-ink-text-muted hover:text-ink-text-tertiary transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>
        <h1 className="text-sm font-medium text-ink-text-secondary truncate max-w-[300px]">
          {title || "Inkleaf"}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <SyncStatusIndicator />
        <button
          onClick={importFile}
          className="p-1.5 rounded hover:bg-ink-bg-secondary text-ink-text-muted hover:text-ink-text-tertiary transition-colors"
          title={`Import Markdown file (${mod}O)`}
        >
          <FileInput size={16} />
        </button>
        <button
          onClick={exportActiveNote}
          disabled={!canExport}
          className="p-1.5 rounded hover:bg-ink-bg-secondary text-ink-text-muted hover:text-ink-text-tertiary transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-text-muted disabled:cursor-not-allowed"
          title={canExport ? `Export note as Markdown (${mod}S)` : "Select a note to export"}
        >
          <FileOutput size={16} />
        </button>
        <div className="w-px h-4 bg-ink-border-strong mx-0.5" />
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-ink-bg-secondary text-ink-text-muted hover:text-ink-text-tertiary transition-colors"
          title="Toggle theme (Cmd+Shift+T)"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={() => setShortcutsOpen(true)}
          className="p-1.5 rounded hover:bg-ink-bg-secondary text-ink-text-muted hover:text-ink-text-tertiary transition-colors"
          title={`Keyboard shortcuts (${navigator.platform.includes("Mac") ? "\u2318" : "Ctrl+"}/)` }
        >
          <HelpCircle size={16} />
        </button>
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-bg-secondary hover:bg-ink-bg-elevated text-ink-text-muted text-sm transition-colors"
        >
          <Search size={14} />
          <span>Search</span>
          <kbd className="text-xs text-ink-text-faint bg-ink-bg-elevated px-1.5 py-0.5 rounded ml-1">
            {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}K
          </kbd>
        </button>
      </div>
    </header>
    <KeyboardShortcutsDialog open={shortcutsOpen} onClose={closeShortcuts} />
    </>
  );
}
