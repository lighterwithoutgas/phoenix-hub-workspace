/**
 * One-time MongoDB seeder for Phoenix Hub Workspace.
 *
 * Usage:
 *   1. Copy .env.example to .env.local.
 *   2. Set MONGODB_URI and optionally MONGODB_DB.
 *   3. Run: npm.cmd run seed:mongo
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeed } from "../src/lib/mock/seed";
import { mongoSeed } from "../src/lib/mongo/workspace";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    process.env[key.trim()] ??= value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main() {
  await mongoSeed(buildSeed());
  console.log("Seeded MongoDB workspace data.");
}

main().catch((error: unknown) => {
  const err = error as { code?: number | string; codeName?: string; message?: string };
  if (err.code === 8000 || err.codeName === "AtlasError") {
    console.error("MongoDB Atlas rejected the credentials in MONGODB_URI.");
    console.error("Use a Database Access user, not your Atlas login, and URL-encode special characters in the password.");
  } else if (err.message?.includes("querySrv")) {
    console.error("Could not resolve the MongoDB Atlas SRV hostname. Check your network, IP access list, and MONGODB_URI.");
  } else {
    console.error(error);
  }
  process.exit(1);
});
