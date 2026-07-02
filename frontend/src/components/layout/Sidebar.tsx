import { useMemo } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import InkleafLogo from "../InkleafLogo";
import NoteList from "../notes/NoteList";
import TagTree from "../tags/TagTree";
import type { Note } from "../../api/client";

interface SidebarProps {
  notes: Note[];
  filteredNotes: Note[];
  activeNoteId: string | null;
  activeTag: string | null;
  expandedTagPaths: string[];
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onCreateNote: () => void;
  onSelectTag: (tag: string | null) => void;
  onToggleTagExpanded: (path: string) => void;
  tagsSectionOpen: boolean;
  onToggleTagsSection: () => void;
}

export default function Sidebar({
  notes,
  filteredNotes,
  activeNoteId,
  activeTag,
  expandedTagPaths,
  onSelectNote,
  onDeleteNote,
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
    </aside>
  );
}
