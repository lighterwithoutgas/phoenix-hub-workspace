"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Task, WorkspaceData } from "@/lib/types";
import { StatusBadge, PriorityBadge, ProgressBar, Avatar, LeaderBadge, EmptyState } from "./ui";
import { assignmentAr, statusAr, fmtDate } from "@/lib/arabic";
import { getTeam, getUser } from "@/lib/selectors";
import { Users2, Clock } from "lucide-react";
import { cn, isDelayed } from "@/lib/utils";

export function TaskCard({ task, data }: { task: Task; data: WorkspaceData }) {
  const team = task.assignedTeamIds[0] ? getTeam(data, task.assignedTeamIds[0]) : undefined;
  const leader = team?.leaderIds[0] ? getUser(data, team.leaderIds[0]) : undefined;
  const assignees = task.assignedUserIds.map((id) => getUser(data, id)).filter(Boolean);
  const delayed = isDelayed(task);

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="card card-pad block transition-shadow hover:border-outline-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="meta" dir="ltr">{task.taskNumber}</p>
          <h3 className="mt-0.5 truncate font-medium text-on-surface">{task.title}</h3>
        </div>
        <StatusBadge status={task.status} delayed={delayed} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        <span className="badge bg-surface-container text-on-surface-variant">
          {task.assignmentType === "team_shared" || task.assignmentType === "team_member_copies" ? <Users2 className="h-3 w-3" /> : null}
          {assignmentAr[task.assignmentType]}
        </span>
      </div>

      {task.assignmentType === "team_shared" && team && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-card bg-surface-low px-2.5 py-2 text-xs">
          <span className="font-medium text-on-surface">مُسندة إلى: {team.name}</span>
          {leader && (
            <span className="flex items-center gap-1.5 text-on-surface-variant">
              قائد الفريق: {leader.name} <LeaderBadge />
            </span>
          )}
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-on-surface-variant">
          <span>التقدم</span>
          <span className="font-mono">{task.progress}%</span>
        </div>
        <ProgressBar value={task.progress} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2 space-x-reverse">
          {assignees.slice(0, 4).map((u) => u && <Avatar key={u.id} name={u.name} size={26} />)}
        </div>
        <span className={cn("flex items-center gap-1 text-xs", delayed ? "text-error" : "text-on-surface-variant")}>
          <Clock className="h-3.5 w-3.5" /> {fmtDate(task.dueDate)}
        </span>
      </div>
    </Link>
  );
}

const STATUS_FILTERS = ["all", "pending_acceptance", "scheduled", "in_progress", "blocked", "awaiting_review", "completed"] as const;

export function TaskList({ tasks, data }: { tasks: Task[]; data: WorkspaceData }) {
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return tasks.filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (q === "" || t.title.includes(q) || t.taskNumber.toLowerCase().includes(q.toLowerCase()))
    );
  }, [tasks, status, q]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="بحث في المهام…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث في المهام" />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs transition-colors",
                status === s ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-high"
              )}
            >
              {s === "all" ? "الكل" : statusAr[s]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="لم يتم العثور على نتائج مطابقة" hint="جرّب تعديل عوامل التصفية." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} data={data} />
          ))}
        </div>
      )}
    </div>
  );
}
