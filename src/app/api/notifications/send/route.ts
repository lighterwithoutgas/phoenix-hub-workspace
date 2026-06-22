import { NextResponse, type NextRequest } from "next/server";
import { mongoFindUserById, mongoLoad } from "@/lib/mongo/workspace";
import { appOrigin, escapeHtml, emailProvider, sendEmail, senderFromEnv, type EmailContent } from "@/lib/server/email";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

type NotificationEmail = Pick<Notification, "recipientId" | "title" | "message" | "taskId" | "type">;

interface NotificationEmailPayload {
  notifications: NotificationEmail[];
}

function notificationEmail(notification: NotificationEmail, to: string, origin: string) {
  const title = escapeHtml(notification.title);
  const message = escapeHtml(notification.message || notification.title);
  const taskUrl = notification.taskId ? `${origin}/tasks/${encodeURIComponent(notification.taskId)}` : "";

  return {
    to,
    subject: `Phoenix Hub - ${notification.title}`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a">
        <h2 style="margin:0 0 12px">${title}</h2>
        <p>${message}</p>
        ${
          taskUrl
            ? `<p><a href="${taskUrl}" style="display:inline-block;background:#001b3f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px">فتح المهمة</a></p>`
            : ""
        }
        <p style="color:#64748b;font-size:13px">تم إرسال هذا الإشعار من Phoenix Hub.</p>
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
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as NotificationEmailPayload;
    const notifications = Array.isArray(payload.notifications) ? payload.notifications.slice(0, 20) : [];
    if (!notifications.length) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0 });
    }

    const workspace = await mongoLoad();
    const usersById = new Map(workspace.users.map((user) => [user.id, user]));
    const origin = appOrigin(request);

    const messages = notifications
      .map((notification) => {
        const recipient = usersById.get(notification.recipientId);
        if (!recipient || recipient.accountStatus !== "active") return null;
        return { ...notificationEmail(notification, recipient.email, origin), from };
      })
      .filter((message): message is EmailContent => message !== null);

    const results = await Promise.allSettled(messages.map((message) => sendEmail(message)));
    const sent = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - sent;

    if (failed) {
      console.error("Notification email failures", results.filter((result) => result.status === "rejected"));
    }

    return NextResponse.json({ ok: failed === 0, sent, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send notification emails";
    console.error("Notification email failed", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
