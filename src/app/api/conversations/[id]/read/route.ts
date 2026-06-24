import { NextResponse, type NextRequest } from "next/server";
import { mongoFindUserById } from "@/lib/mongo/workspace";
import { mongoFindConversation, mongoMarkConversationRead } from "@/lib/mongo/messages";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actorId = request.headers.get("x-phoenix-user-id");
    const actor = actorId ? await mongoFindUserById(actorId) : null;
    if (!actor || actor.accountStatus !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversation = await mongoFindConversation(params.id);
    if (!conversation || !conversation.participantIds.includes(actor.id)) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await mongoMarkConversationRead(conversation.id, actor.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to mark conversation read", error);
    return NextResponse.json({ error: "Failed to mark conversation read" }, { status: 500 });
  }
}
