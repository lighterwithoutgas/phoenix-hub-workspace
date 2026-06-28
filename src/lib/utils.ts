import { clsx, type ClassValue } from "clsx";
import type { Task } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// "Delayed" is a derived display fact, never a stored status. A task is delayed
// when its due date has passed and it is still the assignee's responsibility to
// move forward. Submitted (awaiting_review) and not-yet-accepted
// (pending_acceptance) tasks are excluded, as are terminal statuses. Because this
// is derived, moving the due date forward clears the label automatically.
const DELAYED_EXCLUDED_STATUS = new Set<Task["status"]>([
  "completed",
  "cancelled",
  "awaiting_review",
  "pending_acceptance",
]);

export function isDelayed(task: Pick<Task, "status" | "dueDate">): boolean {
  if (DELAYED_EXCLUDED_STATUS.has(task.status)) return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]).join("");
}

export function avatarColor(seed: string): string {
  const palette = ["#031635", "#006b5f", "#b06d00", "#c14b3a", "#1a2b4b", "#3a5a7a"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}
