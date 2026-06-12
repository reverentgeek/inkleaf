// Offline search over the local SQLite store using FTS5. Results are mapped
// into the same wire shapes as Atlas Search (score + highlights), so the
// frontend renders them without knowing which engine answered.
import { getSqlite } from "../db/sqlite.js";
import type {
  SearchResult,
  SearchHighlight,
  AutocompleteResult,
} from "../types/index.js";

// Sentinel characters used by snippet() to mark match boundaries —
// chosen because they can't appear in normal note text.
const HIT_START = "\u0001";
const HIT_END = "\u0002";

// FTS5 MATCH treats raw input as query syntax and throws on characters like
// ", -, ( — so every token is quote-wrapped. The last token gets a * for
// prefix matching (search-as-you-type).
function toFtsQuery(query: string): string {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  return tokens
    .map((token, i) => {
      const escaped = token.replace(/"/g, '""');
      return i === tokens.length - 1 ? `"${escaped}"*` : `"${escaped}"`;
    })
    .join(" ");
}

// Splits a snippet() string on the hit sentinels into the
// {value, type: 'hit'|'text'} segments the frontend already renders.
function parseSnippet(snippet: string): SearchHighlight["texts"] {
  const texts: SearchHighlight["texts"] = [];
  const segments = snippet.split(HIT_START);
  if (segments[0]) texts.push({ value: segments[0], type: "text" });
  for (let i = 1; i < segments.length; i++) {
    const endIdx = segments[i].indexOf(HIT_END);
    const hit = endIdx === -1 ? segments[i] : segments[i].slice(0, endIdx);
    const rest = endIdx === -1 ? "" : segments[i].slice(endIdx + 1);
    if (hit) texts.push({ value: hit, type: "hit" });
    if (rest) texts.push({ value: rest, type: "text" });
  }
  return texts;
}

interface LocalSearchRow {
  id: string;
  title: string;
  markdown: string;
  tags: string;
  score: number;
  title_snip: string;
  md_snip: string;
}

export function localSearch(query: string, tags?: string[]): SearchResult[] {
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) return [];

  const params: (string | number)[] = [ftsQuery];
  let tagClause = "";
  if (tags && tags.length > 0) {
    // Same hierarchical-tag semantics as the sidebar filter: a note matches
    // if any of its tags equals the filter tag or sits underneath it.
    const conditions = tags
      .map(() => "je.value = ? OR je.value LIKE ? || '/%'")
      .join(" OR ");
    tagClause = `AND EXISTS (SELECT 1 FROM json_each(n.tags) je WHERE ${conditions})`;
    for (const tag of tags) params.push(tag, tag);
  }

  const rows = getSqlite()
    .prepare(
      `SELECT n.id, n.title, n.markdown, n.tags,
              -bm25(notes_fts) AS score,
              snippet(notes_fts, 0, char(1), char(2), '…', 8)  AS title_snip,
              snippet(notes_fts, 1, char(1), char(2), '…', 16) AS md_snip
       FROM notes_fts
       JOIN notes n ON n.rowid = notes_fts.rowid
       WHERE notes_fts MATCH ? AND n.deleted = 0 ${tagClause}
       ORDER BY bm25(notes_fts)
       LIMIT 20`,
    )
    .all(...params) as unknown as LocalSearchRow[];

  return rows.map((row) => {
    const highlights: SearchHighlight[] = [];
    if (row.title_snip.includes(HIT_START)) {
      highlights.push({ path: "title", texts: parseSnippet(row.title_snip) });
    }
    if (row.md_snip.includes(HIT_START)) {
      highlights.push({ path: "markdown", texts: parseSnippet(row.md_snip) });
    }
    return {
      _id: row.id,
      title: row.title,
      markdown: row.markdown,
      tags: JSON.parse(row.tags) as string[],
      score: row.score,
      highlights,
    };
  });
}

export function localAutocomplete(query: string): AutocompleteResult[] {
  const q = query.trim();
  if (!q) return [];
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);

  const rows = getSqlite()
    .prepare(
      `SELECT id, title FROM notes
       WHERE deleted = 0 AND title LIKE '%' || ? || '%' ESCAPE '\\'
       ORDER BY (CASE WHEN title LIKE ? || '%' ESCAPE '\\' THEN 0 ELSE 1 END),
                updated_at DESC
       LIMIT 8`,
    )
    .all(escaped, escaped) as unknown as { id: string; title: string }[];

  return rows.map((row) => ({ _id: row.id, title: row.title }));
}
