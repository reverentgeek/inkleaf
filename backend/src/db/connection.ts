import { MongoClient, Db } from "mongodb";
import { config } from "../config.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  if (!config.mongodbUri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  client = new MongoClient(config.mongodbUri);
  await client.connect();
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
