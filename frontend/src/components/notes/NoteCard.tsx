import { FileText, Trash2 } from "lucide-react";
import type { Note } from "../../api/client";

interface NoteCardProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  isVault?: boolean;
}

export default function NoteCard({
  note,
  isActive,
  onClick,
  onDelete,
  isVault,
}: NoteCardProps) {
  const preview =
    note.markdown?.split("\n").find((l) => l.trim())?.slice(0, 80) || "";
  const date = new Date(note.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors group ${
        isActive
          ? isVault
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-indigo-500/10 border-indigo-500/30"
          : "bg-transparent border-transparent hover:bg-slate-800/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText
            size={14}
            className={`flex-shrink-0 ${isVault ? "text-amber-500" : "text-slate-500"}`}
          />
          <span className="font-medium text-sm truncate">
            {note.title || "Untitled"}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-1 truncate">{preview}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-slate-600">{date}</span>
        {note.tags?.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400"
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}
