import { MongoClient, Db } from "mongodb";
import { config } from "../config.js";

let client: MongoClient | null = null;
let db: Db | null = null;
let connecting: Promise<Db> | null = null;

export function connectToDatabase(): Promise<Db> {
  if (db) return Promise.resolve(db);
  // Share one in-flight attempt; on failure it resets so callers can retry.
  if (!connecting) {
    connecting = doConnect().finally(() => {
      connecting = null;
    });
  }
  return connecting;
}

async function doConnect(): Promise<Db> {
  if (!config.mongodbUri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  // Fail fast when Atlas is unreachable (default is 30s) — offline mode
  // depends on connection attempts resolving quickly.
  const newClient = new MongoClient(config.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await newClient.connect();
  } catch (err) {
    await newClient.close().catch(() => {});
    throw err;
  }

  client = newClient;
  db = client.db(config.dbName);
  console.log("Connected to MongoDB Atlas");
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error("Database not connected. Call connectToDatabase() first.");
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error("Client not connected. Call connectToDatabase() first.");
  }
  return client;
}

export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
