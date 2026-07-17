import { useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import type { Note } from "../../api/client";
import ConfirmDialog from "../ConfirmDialog";

interface NoteCardProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
  // Normal mode: soft-delete (recoverable via toast/trash).
  onDelete: () => void;
  // Trash mode: show Restore + Delete-forever instead of the trash button.
  trashMode?: boolean;
  onRestore?: () => void;
}

// First body line of the note with Markdown syntax stripped; skips lines
// that just repeat the title so the preview adds information.
function getPreview(markdown: string | undefined, title: string): string {
  if (!markdown) return "";
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("```") || line === "---") continue;
    const text = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^(?:[-*+]|\d+\.)\s+/, "")
      .replace(/^>\s*/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    if (!text || text === title.trim()) continue;
    return text.slice(0, 120);
  }
  return "";
}

// Relative time for today's notes, calendar date otherwise.
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    const mins = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}

export default function NoteCard({
  note,
  isActive,
  onClick,
  onDelete,
  trashMode = false,
  onRestore,
}: NoteCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Soft delete is recoverable (undo toast + trash), so no confirmation.
    onDelete();
  };

  const handleRestoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRestore?.();
  };

  const handlePurgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const preview = getPreview(note.markdown, note.title || "");
  const date = formatDate(note.updatedAt);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        data-note-row
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
        className={`relative group w-full text-left pl-3 pr-2 py-1.5 rounded-md cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink-accent/60 ${
          isActive ? "bg-ink-accent/10" : "hover:bg-ink-bg-secondary/60"
        }`}
      >
        <span
          aria-hidden
          className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-colors ${
            isActive ? "bg-ink-accent" : "bg-transparent"
          }`}
        />
        <div className="flex items-baseline gap-2">
          <span
            className={`flex-1 min-w-0 truncate text-[13px] font-medium ${
              isActive ? "text-ink-text-primary" : "text-ink-text-secondary"
            }`}
          >
            {note.title || "Untitled"}
          </span>
          {/* Date swaps out for hover actions — same slot, no layout shift */}
          <span className="relative shrink-0 flex items-baseline justify-end min-w-10">
            <span className="text-[11px] tabular-nums text-ink-text-faint transition-opacity group-hover:opacity-0">
              {date}
            </span>
            {trashMode ? (
              <span className="absolute -right-0.5 -top-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={handleRestoreClick}
                  className="p-0.5 rounded text-ink-text-faint hover:text-ink-accent-lighter transition-colors"
                  title="Restore note"
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  onClick={handlePurgeClick}
                  className="p-0.5 rounded text-ink-text-faint hover:text-ink-danger-light transition-colors"
                  title="Delete forever"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ) : (
              <button
                onClick={handleDeleteClick}
                className="absolute -right-0.5 -top-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-ink-text-faint hover:text-ink-danger-light transition-opacity"
                title="Move to trash"
              >
                <Trash2 size={13} />
              </button>
            )}
          </span>
        </div>
        {preview && (
          <p className="mt-px truncate text-xs text-ink-text-faint">{preview}</p>
        )}
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="Delete forever"
        message={`Permanently delete "${note.title || "Untitled"}"? This cannot be undone.`}
        confirmLabel="Delete forever"
        onConfirm={() => {
          setShowConfirm(false);
          onDelete();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
