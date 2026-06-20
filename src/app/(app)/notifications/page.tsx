"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ClipboardList, ShieldAlert, CalendarClock, MessageSquare, CheckCircle2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { EmptyState } from "@/components/ui";
import { fmtRelative } from "@/lib/arabic";

const typeIcon: Record<string, React.ElementType> = {
  task_assigned: ClipboardList, task_blocked: ShieldAlert, extension_request: CalendarClock,
  comment: MessageSquare, review: CheckCircle2, status_change: ClipboardList,
};

export default function NotificationsPage() {
  const { currentUser, data, markRead, markAllRead } = useWorkspace();
  const mine = useMemo(
    () => (currentUser ? data.notifications.filter((n) => n.recipientId === currentUser.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) : []),
    [data.notifications, currentUser]
  );
  if (!currentUser) return null;
  const unread = mine.filter((n) => !n.read).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">الإشعارات</h1>
          <p className="meta mt-1">{unread > 0 ? `لديك ${unread} إشعار غير مقروء` : "كل الإشعارات مقروءة"}</p>
        </div>
        {unread > 0 && <button onClick={markAllRead} className="btn-outline gap-2"><CheckCheck className="h-4 w-4" /> تحديد الكل كمقروء</button>}
      </header>

      {mine.length === 0 ? <EmptyState title="لا توجد إشعارات" icon={Bell} /> : (
        <div className="card divide-y divide-outline-variant/40">
          {mine.map((n) => {
            const Icon = typeIcon[n.type] ?? Bell;
            const inner = (
              <div className={`flex items-start gap-3 p-3 transition ${!n.read ? "bg-primary/5" : ""}`}>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-card ${!n.read ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-on-surface">{n.title}</p>
                  <p className="text-sm text-on-surface-variant">{n.message}</p>
                  <p className="meta mt-0.5">{fmtRelative(n.createdAt)}</p>
                </div>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="غير مقروء" />}
              </div>
            );
            return n.taskId ? (
              <Link key={n.id} href={`/tasks/${n.taskId}`} onClick={() => markRead(n.id)} className="block hover:bg-surface-container-low/50">{inner}</Link>
            ) : (
              <button key={n.id} onClick={() => markRead(n.id)} className="block w-full text-right hover:bg-surface-container-low/50">{inner}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
