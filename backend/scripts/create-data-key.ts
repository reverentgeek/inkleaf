import { MongoClient, Binary } from "mongodb";
import { ClientEncryption } from "mongodb-client-encryption";
import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });

const uri = process.env.MONGODB_URI!;
const dbName = "mongodb-notes";
const keyVaultNamespace = `${dbName}.encryption_keyVault`;
const keyPath = resolve(
  import.meta.dirname,
  "../../",
  process.env.ENCRYPTION_KEY_PATH || "./master-key.bin",
);

async function main() {
  if (!uri) {
    console.error("MONGODB_URI is required in .env");
    process.exit(1);
  }

  const masterKey = readFileSync(keyPath);
  const client = new MongoClient(uri);

  try {
    await client.connect();

    // Create unique index on keyAltNames
    const keyVaultDb = client.db(dbName);
    const keyVaultColl = keyVaultDb.collection("encryption_keyVault");

    try {
      await keyVaultColl.createIndex(
        { keyAltNames: 1 },
        {
          unique: true,
          partialFilterExpression: { keyAltNames: { $exists: true } },
        },
      );
      console.log("Created unique index on keyAltNames");
    } catch {
      console.log("keyAltNames index already exists");
    }

    const encryption = new ClientEncryption(client, {
      keyVaultNamespace,
      kmsProviders: {
        local: { key: masterKey },
      },
    });

    const dataKeyId = await encryption.createDataKey("local", {
      keyAltNames: ["vaultNotesKey"],
    });

    const base64Id = (dataKeyId as Binary).buffer.toString("base64");

    console.log("\nData encryption key created successfully!");
    console.log("\nAdd this to your .env file:");
    console.log(`CSFLE_DATA_KEY_ID=${base64Id}`);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
