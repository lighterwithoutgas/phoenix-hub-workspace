// Lightweight runnable check for the derived "delayed" rule.
// Run: npx tsx tests/isDelayed.test.ts
import assert from "node:assert/strict";
import { isDelayed } from "../src/lib/utils";
import type { Task } from "../src/lib/types";

const past = new Date(Date.now() - 86_400_000).toISOString();
const future = new Date(Date.now() + 86_400_000).toISOString();

const make = (status: Task["status"], dueDate: string) =>
  ({ status, dueDate }) as Pick<Task, "status" | "dueDate">;

// Active + past due => delayed
assert.equal(isDelayed(make("in_progress", past)), true, "in_progress past due is delayed");
assert.equal(isDelayed(make("scheduled", past)), true, "scheduled past due is delayed");
assert.equal(isDelayed(make("blocked", past)), true, "blocked past due is delayed");

// Future due => never delayed (the "day renewed" case after an extension)
assert.equal(isDelayed(make("in_progress", future)), false, "future due is not delayed");

// Excluded statuses => never delayed even when past due
for (const s of ["completed", "cancelled", "awaiting_review", "pending_acceptance"] as const) {
  assert.equal(isDelayed(make(s, past)), false, `${s} past due is not delayed`);
}

console.log("isDelayed: all assertions passed");
