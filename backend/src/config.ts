import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  mongodbUri: process.env.MONGODB_URI || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  encryptionKeyPath: process.env.ENCRYPTION_KEY_PATH || "./master-key.bin",
  csfleDataKeyId: process.env.CSFLE_DATA_KEY_ID || "",
  cryptSharedLibPath: process.env.CRYPT_SHARED_LIB_PATH || "",
  dbName: "mongodb-notes",
} as const;
