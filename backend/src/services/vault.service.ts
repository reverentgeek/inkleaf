import { ObjectId } from "mongodb";
import { getEncryptedDb } from "../db/encryption.js";
import { getDb } from "../db/connection.js";
import type { VaultNote } from "../types/index.js";

const COLLECTION = "vault_notes";

function getCollection() {
  return getEncryptedDb().collection<VaultNote>(COLLECTION);
}

export async function listVaultNotes(): Promise<VaultNote[]> {
  return getCollection().find().sort({ updatedAt: -1 }).toArray();
}

export async function getVaultNoteById(id: string): Promise<VaultNote | null> {
  return getCollection().findOne({ _id: new ObjectId(id) });
}

export async function createVaultNote(
  data: Pick<VaultNote, "title" | "markdown" | "tags">,
): Promise<VaultNote> {
  const now = new Date();
  const note: VaultNote = {
    title: data.title,
    markdown: data.markdown,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  const result = await getCollection().insertOne(note as any);
  note._id = result.insertedId;
  return note;
}

export async function updateVaultNote(
  id: string,
  data: Partial<Pick<VaultNote, "title" | "markdown" | "tags">>,
): Promise<VaultNote | null> {
  const update: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  const result = await getCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" },
  );

  return result;
}

export async function deleteVaultNote(id: string): Promise<boolean> {
  const result = await getCollection().deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

// Read via non-encrypted client to show raw ciphertext (demo purposes)
export async function getRawVaultNote(
  id: string,
): Promise<Record<string, unknown> | null> {
  return getDb()
    .collection(COLLECTION)
    .findOne({ _id: new ObjectId(id) });
}
