import OpenAI from "openai";
import { config } from "../config.js";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  if (!openai) {
    openai = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openai;
}

export function prepareTextForEmbedding(
  title: string,
  markdown: string,
  tags: string[],
): string {
  const parts = [title, markdown, tags.join(", ")];
  const combined = parts.filter(Boolean).join("\n\n");
  return combined.slice(0, 8000);
}

async function generateOpenAIEmbedding(text: string): Promise<number[] | null> {
  const client = getOpenAIClient();
  if (!client) {
    console.warn(
      "OpenAI API key not configured — skipping embedding generation",
    );
    return null;
  }

  const response = await client.embeddings.create({
    model: config.embeddingModel,
    input: text,
  });

  return response.data[0].embedding;
}

// MongoDB's Voyage AI embeddings endpoint. `inputType` should be "document" when
// embedding stored content and "query" when embedding a search query — Voyage
// tunes the vector differently for each.
async function generateVoyageEmbedding(
  text: string,
  inputType: "document" | "query",
): Promise<number[] | null> {
  if (!config.voyageApiKey) {
    console.warn(
      "VOYAGE_API_KEY not configured — skipping embedding generation",
    );
    return null;
  }

  const response = await fetch("https://ai.mongodb.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.voyageApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: config.embeddingModel,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Voyage embedding request failed: ${response.status} ${errorText}`,
    );
  }

  const result = (await response.json()) as {
    data: { embedding: number[] }[];
  };
  return result.data[0].embedding;
}

/**
 * Generate an embedding for the given text using the configured provider.
 * `inputType` lets Voyage optimize document vs. query vectors; it is ignored by
 * OpenAI. Returns null when the provider's API key is missing so callers can
 * gracefully skip (the embedding_pending flag stays cleared and won't retry).
 */
export async function generateEmbedding(
  text: string,
  inputType: "document" | "query" = "document",
): Promise<number[] | null> {
  if (config.embeddingProvider === "voyage") {
    return generateVoyageEmbedding(text, inputType);
  }
  return generateOpenAIEmbedding(text);
}
