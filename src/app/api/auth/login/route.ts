import { NextResponse, type NextRequest } from "next/server";
import { mongoFindUserByEmail } from "@/lib/mongo/workspace";
import { verifyPassword } from "@/lib/auth/password";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function publicUser(user: User): User {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.toLowerCase().trim();
    if (!email || !body.password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await mongoFindUserByEmail(email);
    if (!user || user.accountStatus === "suspended" || user.accountStatus === "invited") {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const validPassword = user.passwordHash
      ? verifyPassword(body.password, user.passwordHash)
      : body.password.trim().length > 0;

    if (!validPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({ user: publicUser(user) });
  } catch (error) {
    console.error("Mongo login failed", error);
    return NextResponse.json({ error: "Failed to sign in" }, { status: 500 });
  }
}
