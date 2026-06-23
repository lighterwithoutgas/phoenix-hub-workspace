/**
 * Reset a single member's password.
 *
 * A forgotten password cannot be recovered (passwords are stored as a
 * one-way PBKDF2-SHA256 hash). This sets a NEW password for the account
 * and rewrites its hash so the member can sign in again.
 *
 * Required in .env.local:
 *   MONGODB_URI=
 *   MONGODB_DB=
 *
 * Usage:
 *   npm run reset:password -- <email> [newPassword]
 *
 * If newPassword is omitted, a strong random one is generated and printed.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { getMongoDb } from "../src/lib/mongo/client";
import { hashPassword } from "../src/lib/auth/password";
import { nowIso } from "../src/lib/utils";
import type { User } from "../src/lib/types";

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

function generatePassword(): string {
  // 18 url-safe chars, no ambiguous look-alikes needed for a temporary secret
  return randomBytes(14).toString("base64url").slice(0, 18);
}

async function main() {
  const [emailArg, passwordArg] = process.argv.slice(2);
  if (!emailArg) {
    console.error("Usage: npm run reset:password -- <email> [newPassword]");
    process.exit(1);
  }

  const email = emailArg.toLowerCase().trim();
  const newPassword = passwordArg?.trim() || generatePassword();
  if (newPassword.length < 8) {
    console.error("New password must be at least 8 characters.");
    process.exit(1);
  }

  const db = await getMongoDb();
  // case-insensitive exact match on email
  const user = await db.collection<User>("users").findOne({
    email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const result = await db.collection<User>("users").updateOne(
    { id: user.id },
    { $set: { passwordHash: hashPassword(newPassword), updatedAt: nowIso() } }
  );

  if (result.matchedCount === 0) {
    console.error("Failed to update the user record.");
    process.exit(1);
  }

  console.log("Password reset complete.");
  console.log(`  Name:     ${user.name}`);
  console.log(`  Email:    ${user.email}`);
  console.log(`  Password: ${newPassword}`);
  console.log("Share this with the member over a secure channel and ask them to change it after signing in.");
}

main().catch((error: unknown) => {
  const err = error as { code?: number | string; codeName?: string; message?: string };
  if (err.code === 8000 || err.codeName === "AtlasError") {
    console.error("MongoDB Atlas rejected the credentials in MONGODB_URI.");
  } else if (err.message?.includes("querySrv")) {
    console.error("Could not resolve the MongoDB Atlas SRV hostname. Check your network and MONGODB_URI.");
  } else {
    console.error(error);
  }
  process.exit(1);
});
