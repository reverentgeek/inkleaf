import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { generateEmbedding, prepareTextForEmbedding } from "./embeddings.js";
import type { SemanticResult, Note } from "../types/index.js";

export async function semanticSearch(query: string): Promise<SemanticResult[]> {
  const embedding = await generateEmbedding(query);
  if (!embedding) {
    return [];
  }

  const db = getDb();
  const pipeline = [
    {
      $vectorSearch: {
        index: "notes_vector_index",
        path: "embedding",
        queryVector: embedding,
        numCandidates: 100,
        limit: 10,
      },
    },
    {
      $project: {
        title: 1,
        markdown: 1,
        tags: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  return db
    .collection("notes")
    .aggregate<SemanticResult>(pipeline)
    .toArray();
}

export async function findRelatedNotes(
  noteId: string,
): Promise<SemanticResult[]> {
  const db = getDb();

  const note = await db
    .collection<Note>("notes")
    .findOne({ _id: new ObjectId(noteId) });

  if (!note) return [];

  let embedding = note.embedding;
  if (!embedding) {
    const text = prepareTextForEmbedding(
      note.title,
      note.markdown,
      note.tags,
    );
    embedding = (await generateEmbedding(text)) || undefined;
    if (!embedding) return [];
  }

  const pipeline = [
    {
      $vectorSearch: {
        index: "notes_vector_index",
        path: "embedding",
        queryVector: embedding,
        numCandidates: 50,
        limit: 6,
      },
    },
    {
      $match: {
        _id: { $ne: new ObjectId(noteId) },
      },
    },
    {
      $project: {
        title: 1,
        markdown: 1,
        tags: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
    { $limit: 5 },
  ];

  return db
    .collection("notes")
    .aggregate<SemanticResult>(pipeline)
    .toArray();
}
