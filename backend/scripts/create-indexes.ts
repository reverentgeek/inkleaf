import { MongoClient } from "mongodb";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });

const uri = process.env.MONGODB_URI!;
const dbName = "mongodb-notes";

async function main() {
  if (!uri) {
    console.error("MONGODB_URI is required in .env");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    // Ensure the collection exists (required before creating search indexes)
    const collections = await db.listCollections({ name: "notes" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("notes");
      console.log("Created 'notes' collection");
    }

    // Create Atlas Search index
    console.log("Creating Atlas Search index 'notes_search_index'...");
    try {
      await db.command({
        createSearchIndexes: "notes",
        indexes: [
          {
            name: "notes_search_index",
            definition: {
              mappings: {
                dynamic: false,
                fields: {
                  title: [
                    { type: "string", analyzer: "lucene.standard" },
                    {
                      type: "autocomplete",
                      tokenization: "edgeGram",
                      minGrams: 2,
                      maxGrams: 15,
                    },
                  ],
                  markdown: {
                    type: "string",
                    analyzer: "lucene.standard",
                  },
                  tags: [
                    { type: "string", analyzer: "lucene.keyword" },
                    { type: "token" },
                  ],
                },
              },
            },
          },
        ],
      });
      console.log(
        "Atlas Search index created. It may take 1-5 minutes to build.",
      );
    } catch (err: any) {
      if (err.codeName === "IndexAlreadyExists") {
        console.log("Atlas Search index already exists.");
      } else {
        throw err;
      }
    }

    // Create Vector Search index
    console.log("Creating Vector Search index 'notes_vector_index'...");
    try {
      await db.command({
        createSearchIndexes: "notes",
        indexes: [
          {
            name: "notes_vector_index",
            type: "vectorSearch",
            definition: {
              fields: [
                {
                  type: "vector",
                  path: "embedding",
                  numDimensions: 1536,
                  similarity: "cosine",
                },
              ],
            },
          },
        ],
      });
      console.log(
        "Vector Search index created. It may take 1-5 minutes to build.",
      );
    } catch (err: any) {
      if (err.codeName === "IndexAlreadyExists") {
        console.log("Vector Search index already exists.");
      } else {
        throw err;
      }
    }

    console.log("\nDone! Indexes are building in the background.");
    console.log("Check Atlas UI to verify index status.");
  } finally {
    await client.close();
  }
}

main().catch(console.error);
