import type { Notification, User, WorkspaceData } from "../types";
import type { Invitation } from "../types";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiLoadWorkspace(): Promise<WorkspaceData> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  return readJson<WorkspaceData>(response);
}

export async function apiPersistWorkspace(data: WorkspaceData, actorId: string): Promise<void> {
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-phoenix-user-id": actorId,
    },
    body: JSON.stringify(data),
  });
  await readJson<{ ok: true }>(response);
}

export async function apiLogin(email: string, password: string): Promise<User | null> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.status === 401) return null;
  const body = await readJson<{ user: User }>(response);
  return body.user;
}

export async function apiSendInvitationEmail(
  invitation: Invitation,
  invitedBy: Pick<User, "id" | "name" | "email">,
  actorId: string
): Promise<void> {
  const response = await fetch("/api/invitations/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-phoenix-user-id": actorId,
    },
    body: JSON.stringify({ invitation, invitedBy }),
  });
  await readJson<{ ok: true; id?: string }>(response);
}

export async function apiSendNotificationEmails(
  notifications: Pick<Notification, "recipientId" | "title" | "message" | "taskId" | "type">[],
  actorId: string
): Promise<void> {
  if (!notifications.length) return;
  const response = await fetch("/api/notifications/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-phoenix-user-id": actorId,
    },
    body: JSON.stringify({ notifications }),
  });
  await readJson<{ ok: boolean; sent: number; failed: number }>(response);
}
