import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { mongoFindUserById } from "@/lib/mongo/workspace";
import { can } from "@/lib/permissions";
import type { Invitation, User } from "@/lib/types";

export const dynamic = "force-dynamic";

interface InviteEmailPayload {
  invitation: Invitation;
  invitedBy: Pick<User, "id" | "name" | "email">;
}

interface EmailContent {
  from: string;
  to: string;
  subject: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function appOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      try {
        return new URL(`https://${configured}`).origin;
      } catch {
        return configured.replace(/\/$/, "");
      }
    }
  }
  return request.nextUrl.origin;
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

function emailProvider(): string {
  return (process.env.EMAIL_PROVIDER || "resend").toLowerCase().trim();
}

function senderForProvider(provider: string): string {
  const configured = process.env.EMAIL_FROM?.trim();
  const gmailUser = process.env.GMAIL_USER?.trim();

  if (provider === "gmail") {
    if (configured && !configured.includes("onboarding@resend.dev")) return configured;
    if (gmailUser) return `Phoenix Hub <${gmailUser}>`;
  }

  return configured || "";
}

async function sendWithResend(message: EmailContent): Promise<{ id?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || "Resend failed to send the invitation email");
  }
  return { id: body.id };
}

async function sendWithGmail(message: EmailContent): Promise<{ id?: string }> {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "").trim();
  if (!user || !pass) throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");

  const transportOptions = {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,
    auth: { user, pass },
  } as SMTPTransport.Options;
  const transporter = nodemailer.createTransport(transportOptions);

  const result = await transporter.sendMail(message);
  return { id: result.messageId };
}

async function sendEmail(message: EmailContent): Promise<{ id?: string }> {
  const provider = emailProvider();
  if (provider === "gmail") return sendWithGmail(message);
  if (provider === "resend") return sendWithResend(message);
  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}

export async function POST(request: NextRequest) {
  try {
    const provider = emailProvider();
    const from = senderForProvider(provider);
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
    const result = await sendEmail({ ...email, from });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send invitation email";
    console.error("Invitation email failed", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
