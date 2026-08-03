import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { generateEmbedding, prepareTextForEmbedding } from "./embeddings.js";
import type { SemanticResult, Note } from "../types/index.js";

// Query-driven semantic search lives in hybrid-search.service.ts now, fused with
// full-text results by $rankFusion. This file keeps the one vector operation that
// isn't query-driven: finding notes similar to an existing note.
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
        deletedAt: null,
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
