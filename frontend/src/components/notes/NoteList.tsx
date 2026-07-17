import { useRef } from "react";
import NoteCard from "./NoteCard";
import type { Note } from "../../api/client";

interface NoteListProps {
  notes: Note[];
  activeNoteId: string | null;
  activeTag?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClearFilter?: () => void;
  trashMode?: boolean;
  onRestore?: (id: string) => void;
  emptyMessage?: string;
}

// Notes arrive sorted by updatedAt desc, so consecutive labels form groups.
function groupLabel(dateStr: string): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(new Date(dateStr))) / 86400000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  if (days < 31) return "This month";
  return "Earlier";
}

export default function NoteList({
  notes,
  activeNoteId,
  activeTag,
  onSelect,
  onDelete,
  onClearFilter,
  trashMode = false,
  onRestore,
  emptyMessage,
}: NoteListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const idx = notes.findIndex((n) => n._id === activeNoteId);
    const next =
      e.key === "ArrowDown"
        ? Math.min(idx + 1, notes.length - 1)
        : Math.max(idx - 1, 0);
    const note = notes[next];
    if (!note || note._id === activeNoteId) return;
    onSelect(note._id);
    const row =
      containerRef.current?.querySelectorAll<HTMLElement>("[data-note-row]")[next];
    row?.focus();
    row?.scrollIntoView({ block: "nearest" });
  };

  if (notes.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-ink-text-faint">
        {activeTag ? (
          <>
            <p>No notes tagged “{activeTag}”.</p>
            {onClearFilter && (
              <button
                onClick={onClearFilter}
                className="mt-2 text-ink-accent-lighter hover:underline"
              >
                Show all notes
              </button>
            )}
          </>
        ) : (
          <p>{emptyMessage ?? "No notes yet. Create one to get started."}</p>
        )}
      </div>
    );
  }

  let prevLabel: string | null = null;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-px px-1.5 py-1"
    >
      {notes.map((note) => {
        const label = groupLabel(note.updatedAt);
        const showLabel = label !== prevLabel;
        prevLabel = label;
        return (
          <div key={note._id} className="flex flex-col gap-px">
            {showLabel && (
              <div className="px-1.5 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-text-faint">
                {label}
              </div>
            )}
            <NoteCard
              note={note}
              isActive={note._id === activeNoteId}
              onClick={() => onSelect(note._id)}
              onDelete={() => onDelete(note._id)}
              trashMode={trashMode}
              onRestore={onRestore ? () => onRestore(note._id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
