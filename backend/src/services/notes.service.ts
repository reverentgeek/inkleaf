// Notes CRUD backed by the local SQLite store (offline source of truth).
// Every write marks the row dirty and nudges the sync engine, which pushes
// changes to MongoDB Atlas in the background when a connection is available.
import { ObjectId } from "mongodb";
import { getSqlite, rowToNote, type NoteRow } from "../db/sqlite.js";
import { requestSync } from "./sync.service.js";
import type { NoteDTO } from "../types/index.js";

export async function listNotes(notebookId?: string): Promise<NoteDTO[]> {
  const db = getSqlite();
  const rows = (
    notebookId
      ? db
          .prepare(
            "SELECT * FROM notes WHERE deleted = 0 AND notebook_id = ? ORDER BY updated_at DESC",
          )
          .all(notebookId)
      : db
          .prepare("SELECT * FROM notes WHERE deleted = 0 ORDER BY updated_at DESC")
          .all()
  ) as unknown as NoteRow[];
  return rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<NoteDTO | null> {
  const row = getSqlite()
    .prepare("SELECT * FROM notes WHERE id = ? AND deleted = 0")
    .get(id) as unknown as NoteRow | undefined;
  return row ? rowToNote(row) : null;
}

export async function createNote(
  data: Pick<NoteDTO, "title" | "markdown" | "tags" | "notebookId">,
): Promise<NoteDTO> {
  // Generate a real ObjectId locally so the note round-trips to Atlas
  // with the same _id once the sync engine pushes it.
  const id = new ObjectId().toHexString();
  const now = Date.now();

  getSqlite()
    .prepare(
      `INSERT INTO notes (id, title, markdown, tags, notebook_id, created_at, updated_at, dirty, embedding_pending)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      id,
      data.title || "",
      data.markdown || "",
      JSON.stringify(data.tags || []),
      data.notebookId || "default",
      now,
      now,
      data.markdown ? 1 : 0,
    );

  requestSync();
  return (await getNoteById(id))!;
}

export async function updateNote(
  id: string,
  data: Partial<Pick<NoteDTO, "title" | "markdown" | "tags" | "notebookId">>,
): Promise<NoteDTO | null> {
  const db = getSqlite();
  const existing = db
    .prepare("SELECT * FROM notes WHERE id = ? AND deleted = 0")
    .get(id) as unknown as NoteRow | undefined;
  if (!existing) return null;

  const contentChanged =
    data.title !== undefined ||
    data.markdown !== undefined ||
    data.tags !== undefined;

  db.prepare(
    `UPDATE notes SET
       title = ?, markdown = ?, tags = ?, notebook_id = ?,
       updated_at = ?, dirty = 1,
       embedding_pending = CASE WHEN ? THEN 1 ELSE embedding_pending END
     WHERE id = ?`,
  ).run(
    data.title ?? existing.title,
    data.markdown ?? existing.markdown,
    data.tags !== undefined ? JSON.stringify(data.tags) : existing.tags,
    data.notebookId ?? existing.notebook_id,
    Date.now(),
    contentChanged ? 1 : 0,
    id,
  );

  requestSync();
  return getNoteById(id);
}

export async function deleteNote(id: string): Promise<boolean> {
  // Tombstone: keep the row (hidden from reads) until the remote delete
  // succeeds, at which point the sync engine hard-deletes it.
  const result = getSqlite()
    .prepare(
      "UPDATE notes SET deleted = 1, dirty = 1, updated_at = ? WHERE id = ? AND deleted = 0",
    )
    .run(Date.now(), id);

  if (result.changes === 0) return false;
  requestSync();
  return true;
}
