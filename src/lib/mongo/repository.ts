import type { WorkspaceRepository } from "../repo";
import type { WorkspaceData } from "../types";
import { mongoLoad, mongoPersist } from "./workspace";

export class MongoRepository implements WorkspaceRepository {
  mode = "mongo" as const;

  async fetchAll(): Promise<WorkspaceData> {
    return mongoLoad();
  }

  async persist(data: WorkspaceData): Promise<void> {
    const current = await mongoLoad();
    await mongoPersist(data, current);
  }
}
