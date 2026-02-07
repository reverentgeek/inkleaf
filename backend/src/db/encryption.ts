import { MongoClient, Db, Binary } from "mongodb";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "../config.js";

let encryptedClient: MongoClient | null = null;
let encryptedDb: Db | null = null;

function getLocalMasterKey(): Buffer {
  const keyPath = resolve(
    import.meta.dirname,
    "../../",
    config.encryptionKeyPath,
  );
  return readFileSync(keyPath);
}

function getSchemaMap() {
  if (!config.csfleDataKeyId) {
    throw new Error("CSFLE_DATA_KEY_ID is not set");
  }

  const keyId = new Binary(
    Buffer.from(config.csfleDataKeyId, "base64"),
    Binary.SUBTYPE_UUID,
  );

  return {
    [`${config.dbName}.vault_notes`]: {
      bsonType: "object",
      encryptMetadata: {
        keyId: [keyId],
      },
      properties: {
        markdown: {
          encrypt: {
            bsonType: "string",
            algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random",
          },
        },
      },
    },
  };
}

export async function connectEncryptedClient(): Promise<Db> {
  if (encryptedDb) return encryptedDb;

  if (
    !config.mongodbUri ||
    !config.csfleDataKeyId ||
    !config.encryptionKeyPath
  ) {
    throw new Error(
      "CSFLE is not configured. Required: MONGODB_URI, CSFLE_DATA_KEY_ID, ENCRYPTION_KEY_PATH",
    );
  }

  const masterKey = getLocalMasterKey();
  const kmsProviders = {
    local: { key: masterKey },
  };

  const autoEncryption: Record<string, unknown> = {
    keyVaultNamespace: `${config.dbName}.encryption_keyVault`,
    kmsProviders,
    schemaMap: getSchemaMap(),
  };

  if (config.cryptSharedLibPath) {
    autoEncryption.extraOptions = {
      cryptSharedLibPath: config.cryptSharedLibPath,
    };
  }

  encryptedClient = new MongoClient(config.mongodbUri, {
    autoEncryption,
  } as any);

  await encryptedClient.connect();
  encryptedDb = encryptedClient.db(config.dbName);
  console.log("Connected encrypted CSFLE client");
  return encryptedDb;
}

export function getEncryptedDb(): Db {
  if (!encryptedDb) {
    throw new Error(
      "Encrypted client not connected. Call connectEncryptedClient() first.",
    );
  }
  return encryptedDb;
}

export async function closeEncryptedConnection(): Promise<void> {
  if (encryptedClient) {
    await encryptedClient.close();
    encryptedClient = null;
    encryptedDb = null;
  }
}
