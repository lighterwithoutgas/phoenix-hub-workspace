import { MongoClient, type Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var __phoenixMongoClient: Promise<MongoClient> | undefined;
}

function mongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add it to .env.local before using live Mongo mode.");
  }
  return uri;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!globalThis.__phoenixMongoClient) {
    globalThis.__phoenixMongoClient = new MongoClient(mongoUri()).connect();
  }
  return globalThis.__phoenixMongoClient;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB || "phoenix_hub");
}
