import { Search, PanelLeftClose, PanelLeft } from "lucide-react";
import VaultBadge from "../vault/VaultBadge";

interface HeaderProps {
  title: string;
  isVaultMode: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
}

export default function Header({
  title,
  isVaultMode,
  sidebarOpen,
  onToggleSidebar,
  onOpenSearch,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-300 transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>
        <h1 className="text-sm font-medium text-slate-200 truncate max-w-[300px]">
          {title || "MongoDB Notes"}
        </h1>
        {isVaultMode && <VaultBadge />}
      </div>
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm transition-colors"
      >
        <Search size={14} />
        <span>Search</span>
        <kbd className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded ml-1">
          {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}K
        </kbd>
      </button>
    </header>
  );
}
