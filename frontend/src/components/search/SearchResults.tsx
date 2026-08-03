import React from "react";
import { FileText, Search, Sparkles } from "lucide-react";
import type { SearchResult } from "../../api/client";

interface SearchResultsProps {
  results: SearchResult[];
  onSelect: (id: string) => void;
}

function renderHighlights(
  highlights: SearchResult["highlights"],
): React.ReactElement | null {
  if (!highlights || highlights.length === 0) return null;

  // Atlas returns a highlight per matching passage, and the first one doesn't
  // always contain a marked term. Prefer a passage that does.
  const best =
    highlights.find((h) => h.texts.some((t) => t.type === "hit")) ??
    highlights[0];

  return (
    <p className="text-xs text-ink-text-muted mt-1">
      {best.texts.map((t, i) =>
        t.type === "hit" ? (
          <mark
            key={i}
            className="bg-ink-accent/30 text-ink-accent-lighter px-0.5 rounded"
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

// Shows which retrievers found the note, so a hybrid result is legible: keyword
// match, semantic match, or both. Absent when the backend answered text-only.
function renderMatchedBy(
  matchedBy: SearchResult["matchedBy"],
): React.ReactElement | null {
  if (!matchedBy || matchedBy.length === 0) return null;

  return (
    <span className="flex items-center gap-1 text-ink-text-faint flex-shrink-0">
      {matchedBy.includes("text") && (
        <span title="Keyword match">
          <Search size={10} />
        </span>
      )}
      {matchedBy.includes("vector") && (
        <span title="Semantic match">
          <Sparkles size={10} />
        </span>
      )}
    </span>
  );
}

export default function SearchResults({
  results,
  onSelect,
}: SearchResultsProps) {
  if (results.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {results.map((r) => (
        <button
          key={r._id}
          onClick={() => onSelect(r._id)}
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-bg-secondary/60 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={12} className="text-ink-text-faint flex-shrink-0" />
              <span className="text-sm text-ink-text-secondary truncate">{r.title}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {renderMatchedBy(r.matchedBy)}
              {/* Fused RRF scores are small (~0.01-0.03) — 3 decimals keeps
                  neighboring results distinguishable. */}
              <span className="text-xs text-ink-text-faint">
                {r.score.toFixed(3)}
              </span>
            </div>
          </div>
          {renderHighlights(r.highlights)}
        </button>
      ))}
    </div>
  );
}
