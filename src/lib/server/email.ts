import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { NextRequest } from "next/server";

export interface EmailContent {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function appOrigin(request: NextRequest): string {
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

export function emailProvider(): string {
  const configured = process.env.EMAIL_PROVIDER?.toLowerCase().trim();
  if (configured) return configured;
  if (process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()) return "gmail";
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  return "gmail";
}

export function senderFromEnv(provider = emailProvider()): string {
  const configured = process.env.EMAIL_FROM?.trim();
  const gmailUser = process.env.GMAIL_USER?.trim();

  if (provider === "gmail") {
    if (configured && gmailUser && configured.includes(gmailUser)) return configured;
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
    throw new Error(body.message || "Resend failed to send email");
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
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    auth: { user, pass },
  } as SMTPTransport.Options;

  const transporter = nodemailer.createTransport(transportOptions);
  const result = await transporter.sendMail(message);
  return { id: result.messageId };
}

export async function sendEmail(message: EmailContent): Promise<{ id?: string }> {
  const provider = emailProvider();
  if (provider === "gmail") return sendWithGmail(message);
  if (provider === "resend") return sendWithResend(message);
  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}
