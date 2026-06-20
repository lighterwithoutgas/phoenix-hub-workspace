import type { WorkspaceData } from "../types";
import { buildSeed } from "./seed";

const KEY = "phoenix_hub_data_v1";
const SESSION_KEY = "phoenix_hub_session_v1";

export function loadData(): WorkspaceData {
  if (typeof window === "undefined") return buildSeed();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as WorkspaceData;
  } catch {
    /* fall through to seed */
  }
  const seed = buildSeed();
  saveData(seed);
  return seed;
}

export function saveData(data: WorkspaceData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

export function resetData(): WorkspaceData {
  const seed = buildSeed();
  saveData(seed);
  return seed;
}

export function loadSession(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}

export function saveSession(userId: string | null): void {
  if (typeof window === "undefined") return;
  if (userId) window.localStorage.setItem(SESSION_KEY, userId);
  else window.localStorage.removeItem(SESSION_KEY);
}
