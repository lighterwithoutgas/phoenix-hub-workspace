import type { Collection, Document } from "mongodb";
import { randomUUID } from "node:crypto";
import { getMongoDb } from "./client";
import type {
  Announcement,
  Comment,
  ExtensionRequest,
  Invitation,
  Notification,
  Project,
  Task,
  TaskActivity,
  Team,
  User,
  WorkspaceData,
} from "../types";

type EntityWithId = { id: string };
type CollectionKey = keyof WorkspaceData;

const COLLECTIONS = {
  users: "users",
  teams: "teams",
  tasks: "tasks",
  projects: "projects",
  announcements: "announcements",
  invitations: "invitations",
  activities: "activities",
  comments: "comments",
  notifications: "notifications",
  extensions: "extensions",
} satisfies Record<CollectionKey, string>;

const EMPTY_WORKSPACE: WorkspaceData = {
  users: [],
  teams: [],
  tasks: [],
  projects: [],
  announcements: [],
  invitations: [],
  activities: [],
  comments: [],
  notifications: [],
  extensions: [],
};

function stripMongoId<T>(doc: T & { _id?: unknown }): T {
  const { _id, ...rest } = doc;
  return rest as T;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)])
    ) as T;
  }
  return value;
}

async function readCollection<T extends EntityWithId>(name: string): Promise<T[]> {
  const db = await getMongoDb();
  return db.collection(name).find({}, { projection: { _id: 0 } }).toArray() as unknown as Promise<T[]>;
}

async function syncCollection<T extends EntityWithId>(
  collection: Collection<Document>,
  nextItems: T[],
  prevItems?: T[]
): Promise<void> {
  const previous = prevItems ?? ((await collection.find({}, { projection: { _id: 0 } }).toArray()) as unknown as T[]);
  const nextIds = new Set(nextItems.map((item) => item.id));
  const removedIds = previous.map((item) => item.id).filter((id) => !nextIds.has(id));

  if (nextItems.length) {
    await collection.bulkWrite(
      nextItems.map((item) => ({
        replaceOne: {
          filter: { id: item.id },
          replacement: stripUndefined(item),
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  if (removedIds.length) {
    await collection.deleteMany({ id: { $in: removedIds } });
  }
}

export async function mongoLoad(): Promise<WorkspaceData> {
  const [
    users,
    teams,
    tasks,
    projects,
    announcements,
    invitations,
    activities,
    comments,
    notifications,
    extensions,
  ] = await Promise.all([
    readCollection<User>(COLLECTIONS.users),
    readCollection<Team>(COLLECTIONS.teams),
    readCollection<Task>(COLLECTIONS.tasks),
    readCollection<Project>(COLLECTIONS.projects),
    readCollection<Announcement>(COLLECTIONS.announcements),
    readCollection<Invitation>(COLLECTIONS.invitations),
    readCollection<TaskActivity>(COLLECTIONS.activities),
    readCollection<Comment>(COLLECTIONS.comments),
    readCollection<Notification>(COLLECTIONS.notifications),
    readCollection<ExtensionRequest>(COLLECTIONS.extensions),
  ]);

  return {
    ...EMPTY_WORKSPACE,
    users,
    teams,
    tasks,
    projects,
    announcements,
    invitations,
    activities,
    comments,
    notifications,
    extensions,
  };
}

export async function mongoPersist(next: WorkspaceData, prev?: WorkspaceData): Promise<void> {
  const db = await getMongoDb();
  await Promise.all([
    syncCollection<User>(db.collection(COLLECTIONS.users), next.users, prev?.users),
    syncCollection<Team>(db.collection(COLLECTIONS.teams), next.teams, prev?.teams),
    syncCollection<Task>(db.collection(COLLECTIONS.tasks), next.tasks, prev?.tasks),
    syncCollection<Project>(db.collection(COLLECTIONS.projects), next.projects, prev?.projects),
    syncCollection<Announcement>(db.collection(COLLECTIONS.announcements), next.announcements, prev?.announcements),
    syncCollection<Invitation>(db.collection(COLLECTIONS.invitations), next.invitations, prev?.invitations),
    syncCollection<TaskActivity>(db.collection(COLLECTIONS.activities), next.activities, prev?.activities),
    syncCollection<Comment>(db.collection(COLLECTIONS.comments), next.comments, prev?.comments),
    syncCollection<Notification>(db.collection(COLLECTIONS.notifications), next.notifications, prev?.notifications),
    syncCollection<ExtensionRequest>(db.collection(COLLECTIONS.extensions), next.extensions, prev?.extensions),
  ]);
}

export async function mongoFindUserByEmail(email: string): Promise<User | null> {
  const db = await getMongoDb();
  const user = await db.collection<User>(COLLECTIONS.users).findOne(
    { email: email.toLowerCase().trim() },
    { projection: { _id: 0 } }
  );
  return user ? stripMongoId(user) : null;
}

export async function mongoFindUserById(id: string): Promise<User | null> {
  const db = await getMongoDb();
  const user = await db.collection<User>(COLLECTIONS.users).findOne({ id }, { projection: { _id: 0 } });
  return user ? stripMongoId(user) : null;
}

export async function mongoFindInvitationByToken(token: string): Promise<Invitation | null> {
  const db = await getMongoDb();
  const invitation = await db.collection<Invitation>(COLLECTIONS.invitations).findOne(
    { token },
    { projection: { _id: 0 } }
  );
  return invitation ? stripMongoId(invitation) : null;
}

export async function mongoAcceptInvitation(token: string, passwordHash: string): Promise<User> {
  const db = await getMongoDb();
  const invitation = await mongoFindInvitationByToken(token);
  const now = new Date().toISOString();

  if (!invitation) throw new Error("Invitation not found");
  if (invitation.status === "cancelled") throw new Error("Invitation was cancelled");
  if (invitation.status === "accepted") throw new Error("Invitation was already accepted");
  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    await db.collection<Invitation>(COLLECTIONS.invitations).updateOne(
      { id: invitation.id },
      { $set: { status: "expired" } }
    );
    throw new Error("Invitation expired");
  }

  const existingUser = await db.collection<User>(COLLECTIONS.users).findOne(
    { email: invitation.email.toLowerCase().trim() },
    { projection: { _id: 0 } }
  );

  const user: User = {
    id: existingUser?.id ?? `u_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    name: existingUser?.name ?? invitation.name,
    email: invitation.email.toLowerCase().trim(),
    role: invitation.role,
    teamIds: invitation.teamIds,
    leaderOfTeamIds: invitation.leaderOfTeamIds,
    accountStatus: "active",
    invitationStatus: "accepted",
    passwordHash,
    createdAt: existingUser?.createdAt ?? now,
    updatedAt: now,
  };

  await Promise.all([
    db.collection<User>(COLLECTIONS.users).replaceOne({ id: user.id }, stripUndefined(user), { upsert: true }),
    db.collection<Invitation>(COLLECTIONS.invitations).updateOne(
      { id: invitation.id },
      { $set: { status: "accepted", acceptedAt: now } }
    ),
    invitation.teamIds.length
      ? db.collection<Team>(COLLECTIONS.teams).updateMany(
          { id: { $in: invitation.teamIds } },
          { $addToSet: { memberIds: user.id } }
        )
      : Promise.resolve(),
    invitation.leaderOfTeamIds.length
      ? db.collection<Team>(COLLECTIONS.teams).updateMany(
          { id: { $in: invitation.leaderOfTeamIds } },
          { $addToSet: { leaderIds: user.id } }
        )
      : Promise.resolve(),
  ]);

  return user;
}
