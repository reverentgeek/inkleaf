import React from "react";
import { FileText } from "lucide-react";
import type { SearchResult, SemanticResult } from "../../api/client";

interface SearchResultsProps {
  results: SearchResult[] | SemanticResult[];
  onSelect: (id: string) => void;
  mode: "text" | "semantic";
}

function renderHighlights(
  highlights: SearchResult["highlights"],
): React.ReactElement | null {
  if (!highlights || highlights.length === 0) return null;

  const first = highlights[0];
  return (
    <p className="text-xs text-slate-400 mt-1">
      {first.texts.map((t, i) =>
        t.type === "hit" ? (
          <mark
            key={i}
            className="bg-indigo-500/30 text-indigo-300 px-0.5 rounded"
          >
            {t.value}
          </mark>
        ) : (
          <span key={i}>{t.value}</span>
        ),
      )}
    </p>
  );
}

export default function SearchResults({
  results,
  onSelect,
  mode,
}: SearchResultsProps) {
  if (results.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {results.map((r) => (
        <button
          key={r._id}
          onClick={() => onSelect(r._id)}
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/60 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={12} className="text-slate-500 flex-shrink-0" />
              <span className="text-sm text-slate-200 truncate">{r.title}</span>
            </div>
            <span className="text-xs text-slate-500 flex-shrink-0">
              {mode === "text"
                ? `${r.score.toFixed(2)}`
                : `${(r.score * 100).toFixed(0)}%`}
            </span>
          </div>
          {mode === "text" &&
            "highlights" in r &&
            renderHighlights((r as SearchResult).highlights)}
          {mode === "semantic" && (
            <p className="text-xs text-slate-500 mt-1 truncate">
              {r.markdown?.slice(0, 100)}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
