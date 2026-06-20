import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("base64url");
  return `pbkdf2$${DIGEST}$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, digest, iterationsText, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || digest !== DIGEST || !iterationsText || !salt || !hash) return false;

  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  const expected = Buffer.from(hash, "base64url");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, digest).toString("base64url");
  const actualBuffer = Buffer.from(actual, "base64url");
  return expected.length === actualBuffer.length && timingSafeEqual(expected, actualBuffer);
}
