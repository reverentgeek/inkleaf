import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import InkleafLogo from "../InkleafLogo";
import NoteList from "../notes/NoteList";
import TagTree from "../tags/TagTree";
import ConfirmDialog from "../ConfirmDialog";
import type { Note } from "../../api/client";

interface SidebarProps {
  notes: Note[];
  filteredNotes: Note[];
  trashNotes: Note[];
  sidebarView: "notes" | "trash";
  onSetView: (view: "notes" | "trash") => void;
  activeNoteId: string | null;
  activeTag: string | null;
  expandedTagPaths: string[];
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onRestoreNote: (id: string) => void;
  onPurgeNote: (id: string) => void;
  onEmptyTrash: () => void;
  onCreateNote: () => void;
  onSelectTag: (tag: string | null) => void;
  onToggleTagExpanded: (path: string) => void;
  tagsSectionOpen: boolean;
  onToggleTagsSection: () => void;
}

export default function Sidebar({
  notes,
  filteredNotes,
  trashNotes,
  sidebarView,
  onSetView,
  activeNoteId,
  activeTag,
  expandedTagPaths,
  onSelectNote,
  onDeleteNote,
  onRestoreNote,
  onPurgeNote,
  onEmptyTrash,
  onCreateNote,
  onSelectTag,
  onToggleTagExpanded,
  tagsSectionOpen,
  onToggleTagsSection,
}: SidebarProps) {
  const tagCount = useMemo(
    () => new Set(notes.flatMap((n) => n.tags)).size,
    [notes],
  );
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  if (sidebarView === "trash") {
    return (
      <aside className="w-68 h-full flex flex-col border-r border-ink-border bg-ink-bg-primary">
        {/* Header */}
        <div className="flex items-center gap-2 pl-3 pr-2.5 py-2.5 border-b border-ink-border">
          <button
            onClick={() => onSetView("notes")}
            className="p-1.5 rounded-lg hover:bg-ink-bg-secondary text-ink-text-muted hover:text-ink-text-secondary transition-colors"
            title="Back to notes"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-ink-text-secondary">
            Trash
          </span>
          <span className="text-[11px] tabular-nums text-ink-text-faint">
            {trashNotes.length}
          </span>
          {trashNotes.length > 0 && (
            <button
              onClick={() => setShowEmptyConfirm(true)}
              className="ml-auto text-[11px] text-ink-text-faint hover:text-ink-danger-light transition-colors"
            >
              Empty
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <NoteList
            notes={trashNotes}
            activeNoteId={activeNoteId}
            onSelect={onSelectNote}
            onDelete={onPurgeNote}
            onRestore={onRestoreNote}
            trashMode
            emptyMessage="Trash is empty."
          />
        </div>
        <ConfirmDialog
          open={showEmptyConfirm}
          title="Empty Trash"
          message={`Permanently delete all ${trashNotes.length} note${trashNotes.length === 1 ? "" : "s"} in the trash? This cannot be undone.`}
          confirmLabel="Empty Trash"
          onConfirm={() => {
            setShowEmptyConfirm(false);
            onEmptyTrash();
          }}
          onCancel={() => setShowEmptyConfirm(false)}
        />
      </aside>
    );
  }

  return (
    <aside className="w-68 h-full flex flex-col border-r border-ink-border bg-ink-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between pl-4 pr-2.5 py-2.5 border-b border-ink-border">
        <div className="flex items-center gap-2">
          <InkleafLogo size={16} />
          <span className="text-sm font-semibold text-ink-text-secondary">
            Inkleaf
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

      {/* Tags section */}
      <div className="border-b border-ink-border">
        <button
          onClick={onToggleTagsSection}
          aria-expanded={tagsSectionOpen}
          className="w-full flex items-center gap-1 px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-text-faint hover:text-ink-text-muted transition-colors"
        >
          {tagsSectionOpen ? (
            <ChevronDown size={11} />
          ) : (
            <ChevronRight size={11} />
          )}
          Tags
          <span className="font-normal normal-case tracking-normal tabular-nums">
            {tagCount}
          </span>
        </button>
        {tagsSectionOpen && (
          <div className="max-h-48 overflow-y-auto pb-1">
            <TagTree
              notes={notes}
              activeTag={activeTag}
              expandedPaths={expandedTagPaths}
              onSelectTag={onSelectTag}
              onToggleExpand={onToggleTagExpanded}
            />
          </div>
        )}
      </div>

      {/* Notes section */}
      <div className="flex items-center gap-1.5 pl-3 pr-2.5 pt-2 pb-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-text-faint">
          Notes
        </span>
        <span className="text-[11px] tabular-nums text-ink-text-faint">
          {filteredNotes.length}
        </span>
        {activeTag && (
          <button
            onClick={() => onSelectTag(null)}
            className="ml-auto flex items-center gap-1 min-w-0 pl-2 pr-1 py-0.5 rounded-full bg-ink-accent/10 text-[11px] text-ink-accent-lighter hover:bg-ink-accent/20 transition-colors"
            title="Clear tag filter"
          >
            <span className="truncate">{activeTag}</span>
            <X size={10} className="shrink-0" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <NoteList
          notes={filteredNotes}
          activeNoteId={activeNoteId}
          activeTag={activeTag}
          onSelect={onSelectNote}
          onDelete={onDeleteNote}
          onClearFilter={() => onSelectTag(null)}
        />
      </div>

      {/* Trash entry */}
      <button
        onClick={() => onSetView("trash")}
        className="flex items-center gap-2 px-3 py-2 border-t border-ink-border text-xs text-ink-text-faint hover:text-ink-text-secondary hover:bg-ink-bg-secondary/60 transition-colors"
      >
        <Trash2 size={13} />
        <span>Trash</span>
        {trashNotes.length > 0 && (
          <span className="ml-auto tabular-nums">{trashNotes.length}</span>
        )}
      </button>
    </aside>
  );
}
