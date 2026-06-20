import type { WorkspaceData } from "./types";

// Repository interface - the contract both Mock and Mongo implementations honor.
// The app talks to this interface; swapping the backend never touches the UI.
export interface WorkspaceRepository {
  fetchAll(): Promise<WorkspaceData>;
  persist(data: WorkspaceData): Promise<void>;
  mode: "mock" | "mongo";
}

export const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false"; // default: mock mode on
