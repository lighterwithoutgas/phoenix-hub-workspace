/**
 * Reset MongoDB to a clean official workspace.
 *
 * Required in .env.local:
 *   MONGODB_URI=
 *   MONGODB_DB=
 *   OFFICIAL_OWNER_EMAIL=
 *   OFFICIAL_OWNER_NAME=
 *   OFFICIAL_OWNER_PASSWORD=  (optional, recommended)
 *
 * Usage:
 *   npm.cmd run reset:mongo:official
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getMongoDb } from "../src/lib/mongo/client";
import { hashPassword } from "../src/lib/auth/password";
import { nowIso } from "../src/lib/utils";
import type { User, WorkspaceData } from "../src/lib/types";

const COLLECTIONS: Array<keyof WorkspaceData> = [
  "users",
  "teams",
  "tasks",
  "projects",
  "announcements",
  "invitations",
  "activities",
  "comments",
  "notifications",
  "extensions",
];

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

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing ${key} in .env.local`);
  return value;
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main() {
  const ownerEmail = requiredEnv("OFFICIAL_OWNER_EMAIL").toLowerCase();
  const ownerName = requiredEnv("OFFICIAL_OWNER_NAME");
  const ownerPassword = process.env.OFFICIAL_OWNER_PASSWORD?.trim();
  const db = await getMongoDb();
  const createdAt = nowIso();
  const owner: User = {
    id: "u_owner",
    name: ownerName,
    email: ownerEmail,
    role: "owner",
    teamIds: [],
    leaderOfTeamIds: [],
    accountStatus: "active",
    passwordHash: ownerPassword ? hashPassword(ownerPassword) : undefined,
    createdAt,
    updatedAt: createdAt,
  };

  for (const collection of COLLECTIONS) {
    await db.collection(collection).deleteMany({});
  }
  await db.collection("users").insertOne(owner);
  console.log(`Official workspace reset complete. Owner login: ${ownerEmail}`);
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
