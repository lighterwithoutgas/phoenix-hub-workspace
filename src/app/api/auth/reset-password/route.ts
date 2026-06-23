import { NextResponse, type NextRequest } from "next/server";
import { mongoFindUserById, mongoSetUserPassword } from "@/lib/mongo/workspace";
import { hashPassword } from "@/lib/auth/password";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actorId = request.headers.get("x-phoenix-user-id");
    const actor = actorId ? await mongoFindUserById(actorId) : null;
    if (!actor || !can(actor, "manage_members")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { userId?: string; newPassword?: string };
    const userId = body.userId?.trim();
    const newPassword = body.newPassword?.trim();
    if (!userId || !newPassword) {
      return NextResponse.json({ error: "userId and newPassword are required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const target = await mongoFindUserById(userId);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    // Owner credentials are managed out-of-band (the official reset script).
    if (target.role === "owner") {
      return NextResponse.json({ error: "Cannot reset the owner password here" }, { status: 403 });
    }

    const updated = await mongoSetUserPassword(userId, hashPassword(newPassword));
    if (!updated) {
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset failed", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
