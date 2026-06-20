import { NextResponse, type NextRequest } from "next/server";
import { mongoFindUserById, mongoLoad, mongoPersist } from "@/lib/mongo/workspace";
import type { User, WorkspaceData } from "@/lib/types";

export const dynamic = "force-dynamic";

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Record<keyof WorkspaceData, unknown>>;
  return [
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
  ].every((key) => Array.isArray(candidate[key as keyof WorkspaceData]));
}

function publicUser(user: User): User {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function publicWorkspace(data: WorkspaceData): WorkspaceData {
  return {
    ...data,
    users: data.users.map(publicUser),
  };
}

function preserveServerOnlyFields(next: WorkspaceData, current: WorkspaceData): WorkspaceData {
  const currentUsers = new Map(current.users.map((user) => [user.id, user]));
  return {
    ...next,
    users: next.users.map((user) => {
      const { passwordHash: _ignoredClientPasswordHash, ...safeUser } = user;
      const currentUser = currentUsers.get(user.id);
      return currentUser?.passwordHash ? { ...safeUser, passwordHash: currentUser.passwordHash } : safeUser;
    }),
  };
}

export async function GET() {
  try {
    return NextResponse.json(publicWorkspace(await mongoLoad()));
  } catch (error) {
    console.error("Mongo workspace load failed", error);
    return NextResponse.json({ error: "Failed to load workspace data" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actorId = request.headers.get("x-phoenix-user-id");
    if (!actorId || !(await mongoFindUserById(actorId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!isWorkspaceData(body)) {
      return NextResponse.json({ error: "Invalid workspace payload" }, { status: 400 });
    }

    const current = await mongoLoad();
    await mongoPersist(preserveServerOnlyFields(body, current), current);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mongo workspace persist failed", error);
    return NextResponse.json({ error: "Failed to persist workspace data" }, { status: 500 });
  }
}
