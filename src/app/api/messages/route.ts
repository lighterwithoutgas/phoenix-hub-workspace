import { NextResponse, type NextRequest } from "next/server";
import { mongoFindUserById } from "@/lib/mongo/workspace";
import { mongoCreateMessage, mongoFindConversation, mongoListMessages } from "@/lib/mongo/messages";

export const dynamic = "force-dynamic";

const MAX_BODY = 4000;

export async function GET(request: NextRequest) {
  try {
    const actorId = request.headers.get("x-phoenix-user-id");
    const actor = actorId ? await mongoFindUserById(actorId) : null;
    if (!actor || actor.accountStatus !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversationId = request.nextUrl.searchParams.get("conversationId") ?? "";
    const since = request.nextUrl.searchParams.get("since") ?? undefined;
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const conversation = await mongoFindConversation(conversationId);
    if (!conversation || !conversation.participantIds.includes(actor.id)) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ messages: await mongoListMessages(conversationId, since) });
  } catch (error) {
    console.error("Failed to load messages", error);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actorId = request.headers.get("x-phoenix-user-id");
    const actor = actorId ? await mongoFindUserById(actorId) : null;
    if (!actor || actor.accountStatus !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as { conversationId?: unknown; body?: unknown };
    const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : "";
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!conversationId || !body) {
      return NextResponse.json({ error: "Missing conversationId or body" }, { status: 400 });
    }
    if (body.length > MAX_BODY) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const conversation = await mongoFindConversation(conversationId);
    if (!conversation || !conversation.participantIds.includes(actor.id)) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const message = await mongoCreateMessage(conversationId, actor.id, body);
    return NextResponse.json({ message });
  } catch (error) {
    console.error("Failed to send message", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
