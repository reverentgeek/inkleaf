import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { resolve } from "path";

const keyPath = resolve(import.meta.dirname, "../../master-key.bin");

const key = randomBytes(96);
writeFileSync(keyPath, key);

console.log(`Generated 96-byte local master key at: ${keyPath}`);
console.log("IMPORTANT: Keep this file secure and add it to .gitignore");
