import { MongoClient } from "mongodb";
import { config } from "../src/config.js";
import {
  SEARCH_INDEX,
  VECTOR_INDEX,
  searchIndexDefinition,
  vectorIndexDefinition,
} from "../src/db/search-indexes.js";

const uri = config.mongodbUri;
const dbName = "inkleaf";

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
    console.log(`Creating Atlas Search index '${SEARCH_INDEX}'...`);
    try {
      await db.command({
        createSearchIndexes: "notes",
        indexes: [{ name: SEARCH_INDEX, definition: searchIndexDefinition }],
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
    console.log(
      `Creating Vector Search index '${VECTOR_INDEX}' ` +
        `(${config.embeddingDimensions} dims, provider: ${config.embeddingProvider})...`,
    );
    try {
      await db.command({
        createSearchIndexes: "notes",
        indexes: [
          {
            name: VECTOR_INDEX,
            type: "vectorSearch",
            definition: vectorIndexDefinition(),
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
