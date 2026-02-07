import { Plus, BookOpen, ChevronDown } from "lucide-react";
import NoteList from "../notes/NoteList";
import VaultToggle from "../vault/VaultToggle";
import type { Note, VaultNote } from "../../api/client";

const NOTEBOOKS = ["default", "work", "personal", "learning"];

interface SidebarProps {
  notes: Note[];
  vaultNotes: VaultNote[];
  activeNoteId: string | null;
  isVaultMode: boolean;
  activeNotebook: string | null;
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onCreateNote: () => void;
  onToggleVault: () => void;
  onSetNotebook: (notebook: string | null) => void;
}

export default function Sidebar({
  notes,
  vaultNotes,
  activeNoteId,
  isVaultMode,
  activeNotebook,
  onSelectNote,
  onDeleteNote,
  onCreateNote,
  onToggleVault,
  onSetNotebook,
}: SidebarProps) {
  return (
    <aside className="w-72 h-full flex flex-col border-r border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <BookOpen
            size={16}
            className={isVaultMode ? "text-amber-400" : "text-indigo-400"}
          />
          <span className="text-sm font-semibold text-slate-200">
            {isVaultMode ? "Vault" : "Notes"}
          </span>
        </div>
        <button
          onClick={onCreateNote}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="New Note (Cmd+N)"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Notebook filter (not shown in vault mode) */}
      {!isVaultMode && (
        <div className="px-3 py-2 border-b border-slate-800">
          <div className="relative">
            <select
              value={activeNotebook || ""}
              onChange={(e) =>
                onSetNotebook(e.target.value || null)
              }
              className="w-full appearance-none bg-slate-800 text-sm text-slate-300 rounded-lg px-3 py-1.5 pr-8 border border-slate-700 focus:border-indigo-500/50 focus:outline-none"
            >
              <option value="">All Notebooks</option>
              {NOTEBOOKS.map((nb) => (
                <option key={nb} value={nb}>
                  {nb.charAt(0).toUpperCase() + nb.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* Note List */}
      <div className="flex-1 overflow-y-auto">
        {isVaultMode ? (
          <NoteList
            notes={vaultNotes}
            activeNoteId={activeNoteId}
            onSelect={onSelectNote}
            onDelete={onDeleteNote}
            isVault
          />
        ) : (
          <NoteList
            notes={notes}
            activeNoteId={activeNoteId}
            onSelect={onSelectNote}
            onDelete={onDeleteNote}
          />
        )}
      </div>

      {/* Vault Toggle */}
      <div className="p-3 border-t border-slate-800">
        <VaultToggle isActive={isVaultMode} onToggle={onToggleVault} />
      </div>
    </aside>
  );
}
