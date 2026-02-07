import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { generateEmbedding, prepareTextForEmbedding } from "./embeddings.js";
import type { Note } from "../types/index.js";

const COLLECTION = "notes";

function getCollection() {
  return getDb().collection<Note>(COLLECTION);
}

async function updateEmbedding(noteId: ObjectId, note: Pick<Note, "title" | "markdown" | "tags">) {
  try {
    const text = prepareTextForEmbedding(note.title, note.markdown, note.tags);
    const embedding = await generateEmbedding(text);
    if (embedding) {
      await getCollection().updateOne(
        { _id: noteId },
        { $set: { embedding } },
      );
    }
  } catch (err) {
    console.error("Failed to update embedding:", err);
  }
}

export async function listNotes(notebookId?: string): Promise<Note[]> {
  const filter = notebookId ? { notebookId } : {};
  return getCollection()
    .find(filter, { projection: { embedding: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function getNoteById(id: string): Promise<Note | null> {
  return getCollection().findOne(
    { _id: new ObjectId(id) },
    { projection: { embedding: 0 } },
  );
}

export async function createNote(
  data: Pick<Note, "title" | "markdown" | "tags" | "notebookId">,
): Promise<Note> {
  const now = new Date();
  const note: Note = {
    title: data.title,
    markdown: data.markdown,
    tags: data.tags || [],
    notebookId: data.notebookId || "default",
    createdAt: now,
    updatedAt: now,
  };

  const result = await getCollection().insertOne(note);
  note._id = result.insertedId;

  // Fire-and-forget embedding generation
  if (note.markdown) {
    updateEmbedding(result.insertedId, note);
  }

  return note;
}

export async function updateNote(
  id: string,
  data: Partial<Pick<Note, "title" | "markdown" | "tags" | "notebookId">>,
): Promise<Note | null> {
  const update: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  const result = await getCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after", projection: { embedding: 0 } },
  );

  // Fire-and-forget embedding regeneration if content changed
  if (result && (data.markdown !== undefined || data.title !== undefined || data.tags !== undefined)) {
    updateEmbedding(new ObjectId(id), {
      title: result.title,
      markdown: result.markdown,
      tags: result.tags,
    });
  }

  return result;
}

export async function deleteNote(id: string): Promise<boolean> {
  const result = await getCollection().deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
