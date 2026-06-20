// Email-provider abstraction (Resend / SendGrid). Mock logs to console.
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<{ ok: boolean; id?: string }>;
}

export class MockEmailProvider implements EmailProvider {
  async send(msg: EmailMessage) {
    if (typeof console !== "undefined") {
      console.info("[mock-email]", msg.subject, "→", msg.to);
    }
    return { ok: true, id: `mock_${Date.now()}` };
  }
}

// Server-side Resend example (Cloud Function / Route Handler):
// export class ResendEmailProvider implements EmailProvider {
//   async send(msg: EmailMessage) {
//     const res = await fetch("https://api.resend.com/emails", {
//       method: "POST",
//       headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
//       body: JSON.stringify({ from: "Phoenix Hub <no-reply@phoenixhub.org>", to: msg.to, subject: msg.subject, html: msg.html }),
//     });
//     return { ok: res.ok };
//   }
// }

export function buildAssignmentEmail(taskTitle: string, assignee: string, due: string): EmailMessage {
  return {
    to: assignee,
    subject: "Phoenix Hub — تم إسناد مهمة جديدة إليك",
    html: `<div dir="rtl" style="font-family:sans-serif"><h2>Phoenix Hub</h2><p>تم إسناد مهمة جديدة: <b>${taskTitle}</b></p><p>موعد التسليم: ${due}</p></div>`,
  };
}
