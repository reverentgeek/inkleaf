import NoteCard from "./NoteCard";
import type { Note } from "../../api/client";

interface NoteListProps {
  notes: Note[];
  activeNoteId: string | null;
  activeTag?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClearFilter?: () => void;
}

export default function NoteList({
  notes,
  activeNoteId,
  activeTag,
  onSelect,
  onDelete,
  onClearFilter,
}: NoteListProps) {
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
          <p>No notes yet. Create one to get started.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-px px-1.5 py-1">
      {notes.map((note) => (
        <NoteCard
          key={note._id}
          note={note}
          isActive={note._id === activeNoteId}
          onClick={() => onSelect(note._id)}
          onDelete={() => onDelete(note._id)}
        />
      ))}
    </div>
  );
}
