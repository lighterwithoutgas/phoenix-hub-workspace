import { NextResponse, type NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { mongoAcceptInvitation, mongoFindInvitationByToken } from "@/lib/mongo/workspace";
import type { Invitation, User } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function publicUser(user: User): User {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function invitationState(invitation: Invitation | null): { ok: boolean; status: string; invitation?: Partial<Invitation> } {
  if (!invitation) return { ok: false, status: "not_found" };
  if (invitation.status === "cancelled") return { ok: false, status: "cancelled" };
  if (invitation.status === "accepted") return { ok: false, status: "accepted" };
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return { ok: false, status: "expired" };

  return {
    ok: true,
    status: invitation.status,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ ok: false, status: "missing_token" }, { status: 400 });

  const invitation = await mongoFindInvitationByToken(token);
  const state = invitationState(invitation);
  return NextResponse.json(state, { status: state.ok ? 200 : 404 });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; password?: string };
    const token = body.token?.trim();
    const password = body.password ?? "";

    if (!token) return NextResponse.json({ error: "Invitation token is required" }, { status: 400 });
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const user = await mongoAcceptInvitation(token, hashPassword(password));
    return NextResponse.json({ ok: true, user: publicUser(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to accept invitation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
