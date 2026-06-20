"use client";

import { useMemo } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { can } from "@/lib/permissions";
import { canSeeTask } from "@/lib/permissions";
import { userName } from "@/lib/selectors";
import { Avatar, EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/arabic";

export default function ActivityPage() {
  const { currentUser, data } = useWorkspace();
  const activities = useMemo(() => {
    if (!currentUser) return [];
    const visibleTaskIds = new Set(data.tasks.filter((t) => canSeeTask(currentUser, t, data.users)).map((t) => t.id));
    return data.activities
      .filter((a) => visibleTaskIds.has(a.taskId))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [data, currentUser]);

  if (!currentUser) return null;
  if (!can(currentUser, "access_activity_log")) {
    return <div className="card card-pad text-center"><EmptyState title="غير مصرح" hint="سجل النشاط متاح للمدراء وقادة الفرق." icon={History} /></div>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">سجل النشاط</h1>
        <p className="meta mt-1">كل التغييرات على المهام التي تملك صلاحية رؤيتها</p>
      </header>

      {activities.length === 0 ? <EmptyState title="لا يوجد نشاط" icon={History} /> : (
        <div className="card card-pad">
          <ol className="space-y-3">
            {activities.map((a) => {
              const task = data.tasks.find((t) => t.id === a.taskId);
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <Avatar name={userName(data, a.userId)} size={32} />
                  <div className="min-w-0 flex-1 border-b border-outline-variant/40 pb-3">
                    <p className="text-sm text-on-surface">
                      <span className="font-medium">{userName(data, a.userId)}</span>{" "}
                      <span className="text-on-surface-variant">{a.action}</span>
                      {task && <> — <Link href={`/tasks/${task.id}`} className="text-primary hover:underline">{task.title}</Link></>}
                    </p>
                    <p className="meta mt-0.5">{fmtDateTime(a.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
