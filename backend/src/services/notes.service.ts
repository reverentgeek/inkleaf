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
  // Soft delete: move the note to the trash (recoverable). The row is hidden
  // from normal reads but kept, and the sync engine stamps deletedAt on the
  // Atlas doc rather than removing it. Restore or permanent-delete from trash.
  const now = Date.now();
  const result = getSqlite()
    .prepare(
      "UPDATE notes SET deleted = 1, deleted_at = ?, dirty = 1, updated_at = ? WHERE id = ? AND deleted = 0",
    )
    .run(now, now, id);

  if (result.changes === 0) return false;
  requestSync();
  return true;
}

export async function listTrash(): Promise<NoteDTO[]> {
  const rows = getSqlite()
    .prepare(
      "SELECT * FROM notes WHERE deleted = 1 AND purge_pending = 0 ORDER BY deleted_at DESC",
    )
    .all() as unknown as NoteRow[];
  return rows.map(rowToNote);
}

export async function restoreNote(id: string): Promise<NoteDTO | null> {
  const result = getSqlite()
    .prepare(
      "UPDATE notes SET deleted = 0, deleted_at = NULL, dirty = 1, updated_at = ? WHERE id = ? AND deleted = 1 AND purge_pending = 0",
    )
    .run(Date.now(), id);

  if (result.changes === 0) return null;
  requestSync();
  return getNoteById(id);
}

export async function emptyTrash(): Promise<number> {
  // Mark every trashed note for permanent removal; the sync engine deletes the
  // Atlas docs and hard-deletes the local rows on the next tick.
  const result = getSqlite()
    .prepare(
      "UPDATE notes SET purge_pending = 1, dirty = 1, updated_at = ? WHERE deleted = 1 AND purge_pending = 0",
    )
    .run(Date.now());

  if (result.changes > 0) requestSync();
  return Number(result.changes);
}

export async function purgeNote(id: string): Promise<boolean> {
  // Permanent delete: mark for purge and let the sync engine remove the Atlas
  // doc and then hard-delete the local row. Only trashed notes can be purged.
  const result = getSqlite()
    .prepare(
      "UPDATE notes SET purge_pending = 1, dirty = 1, updated_at = ? WHERE id = ? AND deleted = 1",
    )
    .run(Date.now(), id);

  if (result.changes === 0) return false;
  requestSync();
  return true;
}
