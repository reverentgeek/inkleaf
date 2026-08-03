// Hybrid search: one query, both retrievers, fused by MongoDB's $rankFusion.
//
// $rankFusion (MongoDB 8.0+) runs the $search and $vectorSearch sub-pipelines
// and merges them with reciprocal rank fusion — each document scores
// sum(weight / (rank + 60)) across the pipelines it appeared in. That makes
// keyword and vector scores comparable without hand-calibrating two very
// differently scaled numbers.
//
// Highlights need a workaround: sub-pipelines can't contain $project, and
// `$meta: "searchHighlights"` is gone by the time the fusion stage emits. So the
// text retriever runs a second time on its own purely to harvest highlights,
// which are joined back onto the fused ranking by _id. Documents only the vector
// retriever found get a synthesized snippet (services/snippet.ts).
import { getDb } from "../db/connection.js";
import { config } from "../config.js";
import { generateEmbedding } from "./embeddings.js";
import { buildHighlight, buildExcerpt } from "./snippet.js";
import type { SearchResult, SearchHighlight } from "../types/index.js";

// Each retriever returns this many candidates into the fusion. Wider than the
// final limit so the two result sets actually overlap — with no overlap, RRF
// degenerates into two interleaved lists.
const CANDIDATES = 40;

interface RankFusionScoreDetails {
  details?: Array<{
    inputPipelineName?: string;
    rank?: number;
  }>;
}

interface FusedDoc extends Omit<SearchResult, "highlights"> {
  scoreDetails?: RankFusionScoreDetails;
}

// The full-text half, shared by the fusion sub-pipeline and the highlight run.
// `highlight` is only valid on the standalone run.
function buildSearchStage(
  query: string,
  tags: string[] | undefined,
  withHighlight: boolean,
): Record<string, unknown> {
  const filter: Record<string, unknown>[] = [];
  if (tags && tags.length > 0) {
    filter.push({ text: { query: tags, path: "tags" } });
  }

  return {
    $search: {
      index: "notes_search_index",
      compound: {
        must: [
          {
            text: {
              query,
              path: ["title", "markdown"],
              fuzzy: { maxEdits: 1 },
            },
          },
        ],
        ...(filter.length > 0 ? { filter } : {}),
      },
      ...(withHighlight ? { highlight: { path: ["title", "markdown"] } } : {}),
    },
  };
}

// Which retrievers surfaced this document, read out of $rankFusion's
// scoreDetails. A pipeline the document didn't appear in reports no rank (or a
// non-positive one), so ranks are the provenance signal.
function matchedBy(doc: FusedDoc): SearchResult["matchedBy"] {
  const matched: SearchResult["matchedBy"] = [];
  for (const detail of doc.scoreDetails?.details ?? []) {
    const name = detail.inputPipelineName;
    if ((name === "text" || name === "vector") && (detail.rank ?? 0) > 0) {
      matched.push(name);
    }
  }
  return matched;
}

/**
 * Fuse Atlas Search and Vector Search results for `query`.
 *
 * Returns null when no embedding could be generated (missing API key, provider
 * error) so the caller can fall back to text-only search rather than showing
 * the user an error.
 */
export async function hybridSearch(
  query: string,
  tags?: string[],
): Promise<SearchResult[] | null> {
  const embedding = await generateEmbedding(query, "query");
  if (!embedding) return null;

  const db = getDb();
  const notes = db.collection("notes");

  const fusionPipeline = [
    {
      $rankFusion: {
        input: {
          pipelines: {
            text: [
              buildSearchStage(query, tags, false),
              // Trashed notes stay in Atlas with deletedAt set; `null` also
              // matches docs that never had the field.
              { $match: { deletedAt: null } },
              { $limit: CANDIDATES },
            ],
            vector: [
              {
                $vectorSearch: {
                  index: "notes_vector_index",
                  path: "embedding",
                  queryVector: embedding,
                  numCandidates: CANDIDATES * 5,
                  limit: CANDIDATES,
                },
              },
              { $match: { deletedAt: null } },
            ],
          },
        },
        combination: {
          weights: {
            text: config.hybridTextWeight,
            vector: config.hybridVectorWeight,
          },
        },
        scoreDetails: true,
      },
    },
    {
      $project: {
        title: 1,
        markdown: 1,
        tags: 1,
        score: { $meta: "score" },
        scoreDetails: { $meta: "scoreDetails" },
      },
    },
    { $limit: 20 },
  ];

  const highlightPipeline = [
    buildSearchStage(query, tags, true),
    { $match: { deletedAt: null } },
    {
      $project: {
        highlights: { $meta: "searchHighlights" },
      },
    },
    { $limit: CANDIDATES },
  ];

  const [fused, highlighted] = await Promise.all([
    notes.aggregate<FusedDoc>(fusionPipeline).toArray(),
    notes
      .aggregate<{ _id: unknown; highlights: SearchHighlight[] }>(
        highlightPipeline,
      )
      .toArray(),
  ]);

  const highlightsById = new Map<string, SearchHighlight[]>(
    highlighted.map((doc) => [String(doc._id), doc.highlights ?? []]),
  );

  return fused.map((doc) => {
    const atlasHighlights = highlightsById.get(String(doc._id));
    const highlights =
      atlasHighlights && atlasHighlights.length > 0
        ? atlasHighlights
        : // Vector-only hit: mark any shared terms, else show a plain excerpt.
          (() => {
            const built = buildHighlight(doc.markdown, query);
            return built.length > 0 ? built : buildExcerpt(doc.markdown);
          })();

    return {
      _id: doc._id,
      title: doc.title,
      markdown: doc.markdown,
      tags: doc.tags,
      score: doc.score,
      highlights,
      matchedBy: matchedBy(doc),
    };
  });
}
