// Local SQLite store — the offline source of truth for notes.
// Uses the built-in node:sqlite module (no native deps). Node may print an
// ExperimentalWarning for it on startup; this is harmless.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";
import type { NoteDTO } from "../types/index.js";

let db: DatabaseSync | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,            -- ObjectId hex string
  title       TEXT NOT NULL DEFAULT '',
  markdown    TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  notebook_id TEXT NOT NULL DEFAULT 'default',
  created_at  INTEGER NOT NULL,            -- epoch ms
  updated_at  INTEGER NOT NULL,            -- epoch ms (last-write-wins key)
  deleted     INTEGER NOT NULL DEFAULT 0,  -- tombstone awaiting remote delete
  dirty       INTEGER NOT NULL DEFAULT 0,  -- local change awaiting push
  embedding_pending INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);

-- External-content FTS5 index over notes, kept in sync via triggers
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title, markdown, tags,
  content='notes', content_rowid='rowid'
);
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, markdown, tags)
  VALUES (new.rowid, new.title, new.markdown, new.tags);
END;
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, markdown, tags)
  VALUES ('delete', old.rowid, old.title, old.markdown, old.tags);
END;
CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, markdown, tags)
  VALUES ('delete', old.rowid, old.title, old.markdown, old.tags);
  INSERT INTO notes_fts(rowid, title, markdown, tags)
  VALUES (new.rowid, new.title, new.markdown, new.tags);
END;

CREATE TABLE IF NOT EXISTS sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function getSqlite(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(config.sqlitePath), { recursive: true });
  db = new DatabaseSync(config.sqlitePath);
  db.exec(SCHEMA);
  console.log(`Local SQLite store ready at ${config.sqlitePath}`);
  return db;
}

export function closeSqlite(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export interface NoteRow {
  id: string;
  title: string;
  markdown: string;
  tags: string;
  notebook_id: string;
  created_at: number;
  updated_at: number;
  deleted: number;
  dirty: number;
  embedding_pending: number;
}

// Maps a SQLite row to the wire shape the frontend already consumes
// (string _id, ISO date strings — identical to JSON-serialized Mongo docs).
export function rowToNote(row: NoteRow): NoteDTO {
  return {
    _id: row.id,
    title: row.title,
    markdown: row.markdown,
    tags: JSON.parse(row.tags) as string[],
    notebookId: row.notebook_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function getSyncState(key: string): string | null {
  const row = getSqlite()
    .prepare("SELECT value FROM sync_state WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSyncState(key: string, value: string): void {
  getSqlite()
    .prepare(
      "INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}
