import { NextResponse, type NextRequest } from "next/server";
import { mongoFindUserById } from "@/lib/mongo/workspace";
import { can } from "@/lib/permissions";
import type { Invitation, User } from "@/lib/types";
import { appOrigin, bccFromEnv, escapeHtml, emailProvider, sendEmail, senderFromEnv, type EmailContent } from "@/lib/server/email";

export const dynamic = "force-dynamic";

interface InviteEmailPayload {
  invitation: Invitation;
  invitedBy: Pick<User, "id" | "name" | "email">;
}

function invitationEmail(payload: InviteEmailPayload, origin: string): Omit<EmailContent, "from"> {
  const acceptUrl = `${origin}/accept-invite?token=${encodeURIComponent(payload.invitation.token)}`;
  const name = escapeHtml(payload.invitation.name);
  const inviter = escapeHtml(payload.invitedBy.name);
  const email = escapeHtml(payload.invitation.email);
  const role = escapeHtml(payload.invitation.role);

  return {
    to: payload.invitation.email,
    subject: "Phoenix Hub - دعوة للانضمام",
    text: [
      `مرحبا ${payload.invitation.name},`,
      `${payload.invitedBy.name} دعاك للانضمام إلى مساحة عمل Phoenix Hub.`,
      `البريد: ${payload.invitation.email}`,
      `الدور: ${payload.invitation.role}`,
      "",
      "قبول الدعوة وإنشاء كلمة المرور:",
      acceptUrl,
    ].join("\n"),
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a">
        <h2 style="margin:0 0 12px">دعوة للانضمام إلى Phoenix Hub</h2>
        <p>مرحبا ${name}،</p>
        <p>دعاك ${inviter} للانضمام إلى مساحة عمل Phoenix Hub.</p>
        <p><strong>البريد:</strong> ${email}<br/><strong>الدور:</strong> ${role}</p>
        <p>
          <a href="${acceptUrl}" style="display:inline-block;background:#001b3f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px">
            قبول الدعوة وإنشاء كلمة المرور
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة.</p>
      </div>
    `,
  };
}

export async function POST(request: NextRequest) {
  try {
    const provider = emailProvider();
    const from = senderFromEnv(provider);
    if (!from) {
      return NextResponse.json({ error: "Missing EMAIL_FROM" }, { status: 503 });
    }

    const actorId = request.headers.get("x-phoenix-user-id");
    const actor = actorId ? await mongoFindUserById(actorId) : null;
    if (!actor || !can(actor, "invite_members")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as InviteEmailPayload;
    if (!payload.invitation?.email || !payload.invitation?.name || !payload.invitedBy?.email) {
      return NextResponse.json({ error: "Invalid invitation payload" }, { status: 400 });
    }

    const email = invitationEmail(payload, appOrigin(request));
    const result = await sendEmail({ ...email, from, bcc: bccFromEnv() });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send invitation email";
    console.error("Invitation email failed", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
