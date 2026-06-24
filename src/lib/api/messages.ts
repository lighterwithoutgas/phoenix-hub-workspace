import type { Conversation, ConversationSummary, Message } from "../types";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function authHeaders(actorId: string): HeadersInit {
  return { "Content-Type": "application/json", "x-phoenix-user-id": actorId };
}

export async function apiListConversations(actorId: string): Promise<ConversationSummary[]> {
  const response = await fetch("/api/conversations", {
    cache: "no-store",
    headers: { "x-phoenix-user-id": actorId },
  });
  const body = await readJson<{ conversations: ConversationSummary[] }>(response);
  return body.conversations;
}

export async function apiOpenConversation(targetUserId: string, actorId: string): Promise<Conversation> {
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers: authHeaders(actorId),
    body: JSON.stringify({ targetUserId }),
  });
  const body = await readJson<{ conversation: Conversation }>(response);
  return body.conversation;
}

export async function apiListMessages(
  conversationId: string,
  actorId: string,
  since?: string
): Promise<Message[]> {
  const url = new URL("/api/messages", window.location.origin);
  url.searchParams.set("conversationId", conversationId);
  if (since) url.searchParams.set("since", since);
  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "x-phoenix-user-id": actorId },
  });
  const body = await readJson<{ messages: Message[] }>(response);
  return body.messages;
}

export async function apiSendMessage(
  conversationId: string,
  body: string,
  actorId: string
): Promise<Message> {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: authHeaders(actorId),
    body: JSON.stringify({ conversationId, body }),
  });
  const result = await readJson<{ message: Message }>(response);
  return result.message;
}

export async function apiMarkConversationRead(conversationId: string, actorId: string): Promise<void> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
    headers: { "x-phoenix-user-id": actorId },
  });
  await readJson<{ ok: true }>(response);
}
