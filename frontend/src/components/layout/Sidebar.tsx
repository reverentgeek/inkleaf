import { Plus } from "lucide-react";
import InkleafLogo from "../InkleafLogo";
import NoteList from "../notes/NoteList";
import VaultToggle from "../vault/VaultToggle";
import TagTree from "../tags/TagTree";
import type { Note, VaultNote } from "../../api/client";

interface SidebarProps {
  notes: Note[];
  filteredNotes: Note[];
  vaultNotes: VaultNote[];
  activeNoteId: string | null;
  isVaultMode: boolean;
  activeTag: string | null;
  expandedTagPaths: string[];
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onCreateNote: () => void;
  onToggleVault: () => void;
  onSelectTag: (tag: string | null) => void;
  onToggleTagExpanded: (path: string) => void;
}

export default function Sidebar({
  notes,
  filteredNotes,
  vaultNotes,
  activeNoteId,
  isVaultMode,
  activeTag,
  expandedTagPaths,
  onSelectNote,
  onDeleteNote,
  onCreateNote,
  onToggleVault,
  onSelectTag,
  onToggleTagExpanded,
}: SidebarProps) {
  return (
    <aside className="w-72 h-full flex flex-col border-r border-ink-border bg-ink-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-border">
        <div className="flex items-center gap-2">
          <InkleafLogo size={16} />
          <span className="text-sm font-semibold text-ink-text-secondary">
            {isVaultMode ? "Vault" : "Notes"}
          </span>
        </div>
        <button
          onClick={onCreateNote}
          className="p-1.5 rounded-lg hover:bg-ink-bg-secondary text-ink-text-muted hover:text-ink-text-secondary transition-colors"
          title="New Note (Cmd+N)"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Tag tree (not shown in vault mode) */}
      {!isVaultMode && (
        <div className="max-h-52 overflow-y-auto border-b border-ink-border">
          <TagTree
            notes={notes}
            activeTag={activeTag}
            expandedPaths={expandedTagPaths}
            onSelectTag={onSelectTag}
            onToggleExpand={onToggleTagExpanded}
          />
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
            notes={filteredNotes}
            activeNoteId={activeNoteId}
            onSelect={onSelectNote}
            onDelete={onDeleteNote}
          />
        )}
      </div>

      {/* Vault Toggle */}
      <div className="p-3 border-t border-ink-border">
        <VaultToggle isActive={isVaultMode} onToggle={onToggleVault} />
      </div>
    </aside>
  );
}
