import { useEffect, useState } from "react";
import { Sparkles, FileText } from "lucide-react";
import { api } from "../../api/client";
import type { SemanticResult } from "../../api/client";

interface RelatedNotesProps {
  noteId: string | null;
  onSelect: (id: string) => void;
}

export default function RelatedNotes({ noteId, onSelect }: RelatedNotesProps) {
  const [related, setRelated] = useState<SemanticResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!noteId) {
      setRelated([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    api.semantic
      .related(noteId)
      .then((results) => {
        if (!cancelled && Array.isArray(results)) {
          setRelated(results);
        }
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
        <Sparkles size={14} className="text-emerald-400" />
        <span className="text-sm font-medium text-slate-300">
          Related Notes
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <div className="p-3 text-xs text-slate-500">Finding related notes...</div>
        )}
        {!loading && related.length === 0 && (
          <div className="p-3 text-xs text-slate-500">
            {noteId
              ? "No related notes found"
              : "Select a note to see related content"}
          </div>
        )}
        {related.map((r) => (
          <button
            key={r._id}
            onClick={() => onSelect(r._id)}
            className="w-full text-left p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-slate-500" />
              <span className="text-sm text-slate-300 truncate">
                {r.title}
              </span>
            </div>
            <div className="text-xs text-emerald-400 mt-1">
              {(r.score * 100).toFixed(0)}% similar
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
