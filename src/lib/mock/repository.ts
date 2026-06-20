import type { WorkspaceRepository } from "../repo";
import type { WorkspaceData } from "../types";
import { loadData, saveData } from "./store";

export class MockRepository implements WorkspaceRepository {
  mode = "mock" as const;
  async fetchAll(): Promise<WorkspaceData> {
    return loadData();
  }
  async persist(data: WorkspaceData): Promise<void> {
    saveData(data);
  }
}
