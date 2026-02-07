import OpenAI from "openai";
import { config } from "../config.js";

let openai: OpenAI | null = null;

function getClient(): OpenAI | null {
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

export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  const client = getClient();
  if (!client) {
    console.warn("OpenAI API key not configured — skipping embedding generation");
    return null;
  }

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}
