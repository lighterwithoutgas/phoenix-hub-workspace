import { randomUUID } from "node:crypto";
import { getMongoDb } from "./client";
import type { Conversation, ConversationSummary, Message } from "../types";

const CONVERSATIONS = "conversations";
const MESSAGES = "messages";

// How many of the most recent messages to return on an initial (no `since`) load.
const INITIAL_PAGE = 50;
const PREVIEW_LEN = 120;

function nowIso(): string {
  return new Date().toISOString();
}

function messageId(): string {
  return `msg_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

// Deterministic id for a 1:1 conversation so get-or-create is race-free: two
// requests for the same pair always target the same _id and upsert is idempotent.
function directConversationId(a: string, b: string): string {
  return `dm_${[a, b].sort().join("__")}`;
}

export async function mongoGetOrCreateConversation(
  userA: string,
  userB: string
): Promise<Conversation> {
  const db = await getMongoDb();
  const participantIds = [userA, userB].sort();
  const id = directConversationId(userA, userB);
  const now = nowIso();

  await db.collection<Conversation>(CONVERSATIONS).updateOne(
    { id },
    {
      $setOnInsert: {
        id,
        participantIds,
        lastMessageAt: now,
        lastMessagePreview: "",
        lastReadAt: {},
        createdAt: now,
      },
    },
    { upsert: true }
  );

  const conversation = await db
    .collection<Conversation>(CONVERSATIONS)
    .findOne({ id }, { projection: { _id: 0 } });
  if (!conversation) throw new Error("Failed to create conversation");
  return conversation;
}

export async function mongoFindConversation(id: string): Promise<Conversation | null> {
  const db = await getMongoDb();
  return db
    .collection<Conversation>(CONVERSATIONS)
    .findOne({ id }, { projection: { _id: 0 } });
}

export async function mongoListConversations(userId: string): Promise<ConversationSummary[]> {
  const db = await getMongoDb();
  const conversations = (await db
    .collection<Conversation>(CONVERSATIONS)
    .find({ participantIds: userId }, { projection: { _id: 0 } })
    .sort({ lastMessageAt: -1 })
    .toArray()) as Conversation[];

  return Promise.all(
    conversations.map(async (conversation) => {
      const since = conversation.lastReadAt?.[userId];
      const filter: Record<string, unknown> = {
        conversationId: conversation.id,
        senderId: { $ne: userId },
      };
      if (since) filter.createdAt = { $gt: since };
      const unreadCount = await db.collection<Message>(MESSAGES).countDocuments(filter);
      return { ...conversation, unreadCount };
    })
  );
}

// Returns messages oldest-first. With `since`, only messages strictly newer than
// that ISO timestamp (for incremental polling); otherwise the latest page.
export async function mongoListMessages(
  conversationId: string,
  since?: string
): Promise<Message[]> {
  const db = await getMongoDb();
  const collection = db.collection<Message>(MESSAGES);

  if (since) {
    return collection
      .find({ conversationId, createdAt: { $gt: since } }, { projection: { _id: 0 } })
      .sort({ createdAt: 1 })
      .toArray();
  }

  const recent = await collection
    .find({ conversationId }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(INITIAL_PAGE)
    .toArray();
  return recent.reverse();
}

export async function mongoCreateMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<Message> {
  const db = await getMongoDb();
  const message: Message = {
    id: messageId(),
    conversationId,
    senderId,
    body,
    createdAt: nowIso(),
  };

  await db.collection<Message>(MESSAGES).insertOne({ ...message });
  await db.collection<Conversation>(CONVERSATIONS).updateOne(
    { id: conversationId },
    {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: body.slice(0, PREVIEW_LEN),
        // sender has implicitly read their own message
        [`lastReadAt.${senderId}`]: message.createdAt,
      },
    }
  );
  return message;
}

export async function mongoMarkConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const db = await getMongoDb();
  await db
    .collection<Conversation>(CONVERSATIONS)
    .updateOne({ id: conversationId }, { $set: { [`lastReadAt.${userId}`]: nowIso() } });
}
