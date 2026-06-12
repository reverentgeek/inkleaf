// Background sync engine: pushes local SQLite changes to MongoDB Atlas and
// pulls remote changes down, with last-write-wins conflict resolution keyed
// on updatedAt. Runs on an interval and immediately (debounced) after every
// local write. All Atlas connectivity awareness lives here — the rest of the
// app just asks isOnline().
import { ObjectId, type Collection } from "mongodb";
import { config } from "../config.js";
import { connectToDatabase } from "../db/connection.js";
import {
  getSqlite,
  getSyncState,
  setSyncState,
  type NoteRow,
} from "../db/sqlite.js";
import { generateEmbedding, prepareTextForEmbedding } from "./embeddings.js";
import type { Note, SyncStatus } from "../types/index.js";

let online = false;
let syncing = false;
let lastSyncAt: Date | null = null;
let lastError: string | null = null;
let backoffMs = 0;
let nextAttemptAt = 0;
let debounceTimer: NodeJS.Timeout | undefined;

export function isOnline(): boolean {
  return online;
}

export function getSyncStatus(): SyncStatus {
  const sqlite = getSqlite();
  const pendingPush = (
    sqlite.prepare("SELECT COUNT(*) AS c FROM notes WHERE dirty = 1").get() as {
      c: number;
    }
  ).c;
  const pendingEmbeddings = (
    sqlite
      .prepare(
        "SELECT COUNT(*) AS c FROM notes WHERE embedding_pending = 1 AND deleted = 0",
      )
      .get() as { c: number }
  ).c;

  return {
    online,
    syncing,
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    lastError,
    pendingPush,
    pendingEmbeddings,
  };
}

export function startSyncLoop(): void {
  const storedLastSync = getSyncState("last_sync_at");
  if (storedLastSync) lastSyncAt = new Date(Number(storedLastSync));

  setInterval(() => void tick(), config.syncIntervalMs);
  void tick(true);
}

// Nudge the engine shortly after a local write (debounced so a burst of
// keystroke-driven updates coalesces into one sync).
export function requestSync(): void {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void tick(true), 2000);
}

// Run a sync cycle immediately (used by POST /api/sync/now).
export async function syncNow(): Promise<void> {
  await tick(true);
}

async function tick(force = false): Promise<void> {
  if (syncing) return;
  if (!force && Date.now() < nextAttemptAt) return; // backing off while offline
  syncing = true;

  try {
    const db = await connectToDatabase();
    await db.command({ ping: 1 });
    online = true;
    backoffMs = 0;
    nextAttemptAt = 0;

    ensureRemoteIdentity();

    const collection = db.collection<Note>("notes");
    await pushDirtyNotes(collection);
    await pushPendingEmbeddings(collection);
    await pullRemoteChanges(collection);

    lastSyncAt = new Date();
    setSyncState("last_sync_at", String(lastSyncAt.getTime()));
    lastError = null;
  } catch (err) {
    online = false;
    lastError = err instanceof Error ? err.message : String(err);
    backoffMs = Math.min(backoffMs ? backoffMs * 2 : config.syncIntervalMs, 60_000);
    nextAttemptAt = Date.now() + backoffMs;
  } finally {
    syncing = false;
  }
}

// Identity of the remote this local store last synced with (credentials
// redacted). If the connection string or db name changes, the pull-phase
// reconciliation would otherwise read an empty/new remote as "everything was
// deleted remotely" and wipe the local store. Instead, detect the change and
// re-seed: mark every row dirty (full re-push) and reset the pull checkpoint
// so the new remote's contents merge in via last-write-wins.
function remoteIdentity(): string {
  return `${config.mongodbUri.replace(/\/\/[^@/]*@/, "//")}#${config.dbName}`;
}

function ensureRemoteIdentity(): void {
  const current = remoteIdentity();
  const stored = getSyncState("remote_identity");
  if (stored === current) return;

  const sqlite = getSqlite();
  const { c } = sqlite
    .prepare("SELECT COUNT(*) AS c FROM notes")
    .get() as { c: number };

  // Treat a missing identity (first run with existing data) the same as a
  // changed one — a one-time full re-push is harmless and always safe.
  if (c > 0) {
    console.log(
      `Sync: remote changed${stored ? ` (${stored} -> ${current})` : ""}; re-pushing ${c} local notes`,
    );
    sqlite.exec(
      "UPDATE notes SET dirty = 1, embedding_pending = (deleted = 0)",
    );
    setSyncState("last_pull_at", "0");
  }
  setSyncState("remote_identity", current);
}

async function pushDirtyNotes(collection: Collection<Note>): Promise<void> {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare("SELECT * FROM notes WHERE dirty = 1")
    .all() as unknown as NoteRow[];

  for (const row of rows) {
    const _id = new ObjectId(row.id);
    try {
      if (row.deleted) {
        // Tombstone: delete remotely, then purge the local row
        // (the FTS trigger cleans up the search index).
        await collection.deleteOne({ _id });
        sqlite
          .prepare("DELETE FROM notes WHERE id = ? AND deleted = 1")
          .run(row.id);
        continue;
      }

      const remote = await collection.findOne(
        { _id },
        { projection: { updatedAt: 1 } },
      );
      if (remote && remote.updatedAt.getTime() > row.updated_at) {
        // Remote is newer — last-write-wins: drop the local change and let
        // the pull phase overwrite this row.
        sqlite
          .prepare(
            "UPDATE notes SET dirty = 0, embedding_pending = 0 WHERE id = ? AND updated_at = ?",
          )
          .run(row.id, row.updated_at);
        continue;
      }

      // $set (never replace) — the local store doesn't hold the embedding
      // field, and a replace would silently destroy vector search data.
      await collection.updateOne(
        { _id },
        {
          $set: {
            title: row.title,
            markdown: row.markdown,
            tags: JSON.parse(row.tags) as string[],
            notebookId: row.notebook_id,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          },
        },
        { upsert: true },
      );

      // The updated_at guard avoids clearing dirty if a newer local edit
      // landed while this push was in flight.
      sqlite
        .prepare("UPDATE notes SET dirty = 0 WHERE id = ? AND updated_at = ?")
        .run(row.id, row.updated_at);
    } catch (err) {
      // Leave the row dirty; it will be retried next tick.
      console.error(`Sync: push failed for note ${row.id}:`, err);
    }
  }
}

async function pushPendingEmbeddings(
  collection: Collection<Note>,
): Promise<void> {
  const sqlite = getSqlite();
  // Only embed notes whose content has already been pushed (dirty = 0).
  const rows = sqlite
    .prepare(
      "SELECT * FROM notes WHERE embedding_pending = 1 AND deleted = 0 AND dirty = 0",
    )
    .all() as unknown as NoteRow[];

  for (const row of rows) {
    try {
      const text = prepareTextForEmbedding(
        row.title,
        row.markdown,
        JSON.parse(row.tags) as string[],
      );
      const embedding = await generateEmbedding(text);
      if (embedding) {
        await collection.updateOne(
          { _id: new ObjectId(row.id) },
          { $set: { embedding } },
        );
      }
      // Clear the flag even when embedding is null (no OpenAI key) so we
      // don't retry forever; on thrown errors it stays set and retries.
      sqlite
        .prepare("UPDATE notes SET embedding_pending = 0 WHERE id = ?")
        .run(row.id);
    } catch (err) {
      console.error(`Sync: embedding failed for note ${row.id}:`, err);
    }
  }
}

async function pullRemoteChanges(collection: Collection<Note>): Promise<void> {
  const sqlite = getSqlite();
  const checkpoint = Number(getSyncState("last_pull_at") ?? 0);

  // Docs changed since the last pull checkpoint.
  const pulled = await collection
    .find(
      { updatedAt: { $gt: new Date(checkpoint) } },
      { projection: { embedding: 0 } },
    )
    .toArray();

  // ID reconciliation — catches remote deletions AND reseeds (seed.ts
  // backdates updatedAt below the checkpoint, so the $gt query alone
  // would miss reseeded notes). Cheap at this app's scale.
  const remoteIds = new Set(
    (await collection.find({}, { projection: { _id: 1 } }).toArray()).map(
      (d) => d._id.toHexString(),
    ),
  );

  const localRows = sqlite
    .prepare("SELECT id, updated_at, deleted, dirty FROM notes")
    .all() as unknown as Pick<
    NoteRow,
    "id" | "updated_at" | "deleted" | "dirty"
  >[];
  const localById = new Map(localRows.map((r) => [r.id, r]));

  // Remote docs we don't have locally and that the checkpoint query missed.
  const pulledIds = new Set(pulled.map((d) => d._id.toHexString()));
  const missingIds = [...remoteIds].filter(
    (id) => !localById.has(id) && !pulledIds.has(id),
  );
  if (missingIds.length > 0) {
    const extra = await collection
      .find(
        { _id: { $in: missingIds.map((id) => new ObjectId(id)) } },
        { projection: { embedding: 0 } },
      )
      .toArray();
    pulled.push(...extra);
  }

  // Clean local rows that vanished remotely were deleted on the server.
  // Dirty rows are skipped — they're local changes awaiting push.
  const deleteStmt = sqlite.prepare(
    "DELETE FROM notes WHERE id = ? AND dirty = 0",
  );
  for (const row of localRows) {
    if (!row.dirty && !row.deleted && !remoteIds.has(row.id)) {
      deleteStmt.run(row.id);
    }
  }

  const upsertStmt = sqlite.prepare(
    `INSERT INTO notes (id, title, markdown, tags, notebook_id, created_at, updated_at, deleted, dirty, embedding_pending)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       markdown = excluded.markdown,
       tags = excluded.tags,
       notebook_id = excluded.notebook_id,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       deleted = 0, dirty = 0, embedding_pending = 0`,
  );

  let maxUpdated = checkpoint;
  for (const doc of pulled) {
    const id = doc._id.toHexString();
    const remoteUpdated = new Date(doc.updatedAt).getTime();
    maxUpdated = Math.max(maxUpdated, remoteUpdated);

    const local = localById.get(id);
    if (local && local.dirty && local.updated_at >= remoteUpdated) {
      continue; // local change is newer — it wins and pushes next tick
    }

    upsertStmt.run(
      id,
      doc.title ?? "",
      doc.markdown ?? "",
      JSON.stringify(doc.tags ?? []),
      doc.notebookId ?? "default",
      new Date(doc.createdAt).getTime(),
      remoteUpdated,
    );
  }

  // Checkpoint = max remote updatedAt seen (not "now") to avoid gaps from
  // local/Atlas clock skew.
  if (maxUpdated > checkpoint) {
    setSyncState("last_pull_at", String(maxUpdated));
  }
}
