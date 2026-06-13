import NoteCard from "./NoteCard";
import type { Note } from "../../api/client";

interface NoteListProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function NoteList({
  notes,
  activeNoteId,
  onSelect,
  onDelete,
}: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-ink-text-faint text-sm">
        No notes yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 overflow-y-auto">
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
