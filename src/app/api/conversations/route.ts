import { NextResponse, type NextRequest } from "next/server";
import { mongoFindUserById } from "@/lib/mongo/workspace";
import { mongoGetOrCreateConversation, mongoListConversations } from "@/lib/mongo/messages";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actorId = request.headers.get("x-phoenix-user-id");
    const actor = actorId ? await mongoFindUserById(actorId) : null;
    if (!actor || actor.accountStatus !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ conversations: await mongoListConversations(actor.id) });
  } catch (error) {
    console.error("Failed to list conversations", error);
    return NextResponse.json({ error: "Failed to list conversations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actorId = request.headers.get("x-phoenix-user-id");
    const actor = actorId ? await mongoFindUserById(actorId) : null;
    if (!actor || actor.accountStatus !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { targetUserId?: unknown };
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    if (!targetUserId || targetUserId === actor.id) {
      return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
    }

    const target = await mongoFindUserById(targetUserId);
    if (!target || target.accountStatus !== "active") {
      return NextResponse.json({ error: "Target user not available" }, { status: 404 });
    }

    const conversation = await mongoGetOrCreateConversation(actor.id, target.id);
    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Failed to open conversation", error);
    return NextResponse.json({ error: "Failed to open conversation" }, { status: 500 });
  }
}
