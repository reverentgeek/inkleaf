// Builds Atlas-Search-shaped highlights without Atlas Search.
//
// $rankFusion sub-pipelines can't contain $project, and `$meta:
// "searchHighlights"` isn't available after the fusion stage — so hybrid search
// harvests real highlights from a parallel $search run and uses this for the
// leftovers (documents only the vector retriever surfaced, which by definition
// have no keyword hit to highlight). Same {value, type} segments the frontend
// already renders, so the UI can't tell which path produced them.
import type { SearchHighlight } from "../types/index.js";

// Characters around the matched window, mirroring the local FTS5 snippet width.
const CONTEXT = 90;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight `query`'s terms inside `markdown`, centered on the first match.
 * Returns an empty array when nothing matches, letting callers fall back to a
 * plain excerpt.
 */
export function buildHighlight(
  markdown: string,
  query: string,
): SearchHighlight[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .map(escapeRegExp);
  if (terms.length === 0 || !markdown) return [];

  const pattern = new RegExp(`(${terms.join("|")})`, "gi");
  const firstMatch = pattern.exec(markdown);
  if (!firstMatch) return [];
  pattern.lastIndex = 0;

  // Window the text around the first hit so long notes don't ship whole bodies.
  const start = Math.max(0, firstMatch.index - CONTEXT / 3);
  const window = markdown.slice(start, start + CONTEXT);

  const texts: SearchHighlight["texts"] = [];
  if (start > 0) texts.push({ value: "…", type: "text" });

  let cursor = 0;
  for (let m = pattern.exec(window); m !== null; m = pattern.exec(window)) {
    if (m.index > cursor) {
      texts.push({ value: window.slice(cursor, m.index), type: "text" });
    }
    texts.push({ value: m[0], type: "hit" });
    cursor = m.index + m[0].length;
  }
  if (cursor < window.length) {
    texts.push({ value: window.slice(cursor), type: "text" });
  }
  if (start + CONTEXT < markdown.length) {
    texts.push({ value: "…", type: "text" });
  }

  return [{ path: "markdown", texts }];
}

/**
 * Last-resort excerpt for vector-only hits whose text shares no terms with the
 * query — semantically relevant, literally nothing to mark.
 */
export function buildExcerpt(markdown: string): SearchHighlight[] {
  if (!markdown) return [];
  const value = markdown.slice(0, CONTEXT);
  return [
    {
      path: "markdown",
      texts: [
        {
          value: markdown.length > CONTEXT ? `${value}…` : value,
          type: "text",
        },
      ],
    },
  ];
}
