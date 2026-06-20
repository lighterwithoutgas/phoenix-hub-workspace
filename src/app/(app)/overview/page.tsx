"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, ClipboardList, Clock, FolderKanban,
  ListChecks, PlusCircle, ShieldAlert, UserPlus, Users2, Megaphone, Hourglass,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { isElevated } from "@/lib/permissions";
import {
  tasksFor, myTasks, teamTasks, tasksOfTeam, membersOfTeam, countByStatus,
  completionRate, onTimeRate, userName, getTeam,
} from "@/lib/selectors";
import { StatCard, StatusBadge, PriorityBadge, LeaderBadge, Avatar, SectionTitle, EmptyState } from "@/components/ui";
import { WeeklyCompletionChart, StatusPie, WorkloadBars } from "@/components/Charts";
import { fmtRelative } from "@/lib/arabic";
import type { Task } from "@/lib/types";

export default function OverviewPage() {
  const { currentUser, data } = useWorkspace();
  const visible = useMemo(() => (currentUser ? tasksFor(data, currentUser) : []), [data, currentUser]);
  if (!currentUser) return null;

  if (isElevated(currentUser)) return <AdminOverview tasks={visible} />;
  if (currentUser.role === "team_leader") return <LeaderOverview tasks={visible} />;
  if (currentUser.role === "viewer") return <ViewerOverview tasks={visible} />;
  return <MemberOverview tasks={visible} />;
}

/* ---------------- shared bits ---------------- */

function TaskMiniRow({ task }: { task: Task }) {
  const { data } = useWorkspace();
  const assignee =
    task.assignedTeamIds[0] ? getTeam(data, task.assignedTeamIds[0])?.name
    : task.assignedUserIds[0] ? userName(data, task.assignedUserIds[0])
    : "—";
  return (
    <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-container-low">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-on-surface">{task.title}</p>
        <p className="meta truncate">{assignee} · <span className="font-mono">{task.taskNumber}</span></p>
      </div>
      <PriorityBadge priority={task.priority} />
      <StatusBadge status={task.status} />
    </Link>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link href={href} className="btn-outline gap-2 whitespace-nowrap">
      <Icon className="h-4 w-4" aria-hidden /> {label}
    </Link>
  );
}

/* ---------------- ADMIN / OWNER ---------------- */

function AdminOverview({ tasks }: { tasks: Task[] }) {
  const { currentUser, data } = useWorkspace();
  const active = tasks.filter((t) => !["completed", "cancelled"].includes(t.status));
  const individual = tasks.filter((t) => t.assignmentType === "individual");
  const teamShared = tasks.filter((t) => t.assignmentType === "team_shared");
  const copies = tasks.filter((t) => t.parentAssignmentId);
  const awaiting = tasks.filter((t) => t.status === "awaiting_review");
  const overdue = tasks.filter((t) => t.status === "overdue");
  const blocked = tasks.filter((t) => t.status === "blocked");
  const upcoming = active
    .filter((t) => t.dueDate)
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))
    .slice(0, 6);
  const recentDone = tasks.filter((t) => t.status === "completed").slice(0, 5);
  const activeMembers = data.users.filter((u) => u.accountStatus === "active").length;
  const activeTeams = data.teams.length;
  const workload = data.teams.map((t) => ({
    name: t.name,
    value: tasksOfTeam(tasks, t.id, data.users).filter((task) => !["completed", "cancelled"].includes(task.status)).length,
  }));
  const announcements = [...data.announcements].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)).slice(0, 3);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">نظرة عامة</h1>
          <p className="meta mt-1">مركز قيادة Phoenix Hub — مرحباً {currentUser!.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickAction href="/tasks/new?type=individual" icon={PlusCircle} label="إنشاء مهمة" />
          <QuickAction href="/tasks/new?type=team_shared" icon={Users2} label="مهمة فريق" />
          <QuickAction href="/members?invite=1" icon={UserPlus} label="دعوة عضو" />
          <QuickAction href="/announcements?create=1" icon={Megaphone} label="نشر إعلان" />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="المهام النشطة" value={active.length} icon={ClipboardList} />
        <StatCard label="المهام الفردية" value={individual.length} icon={ListChecks} />
        <StatCard label="مهام الفرق المشتركة" value={teamShared.length} icon={Users2} />
        <StatCard label="مهام الأعضاء المنسوخة" value={copies.length} icon={ClipboardList} />
        <StatCard label="معدل الإنجاز" value={`${completionRate(tasks)}٪`} tone="secondary" icon={CheckCircle2} />
        <StatCard label="نسبة الإنجاز في الموعد" value={`${onTimeRate(tasks)}٪`} tone="secondary" icon={Clock} />
        <StatCard label="المهام المتأخرة" value={overdue.length} tone="error" icon={AlertTriangle} />
        <StatCard label="بانتظار المراجعة" value={awaiting.length} tone="amber" icon={Hourglass} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="المهام المتوقفة" value={blocked.length} tone="amber" icon={ShieldAlert} />
        <StatCard label="الفرق النشطة" value={activeTeams} icon={Users2} />
        <StatCard label="الأعضاء النشطون" value={activeMembers} icon={Users2} />
        <StatCard label="المشاريع" value={data.projects.length} icon={FolderKanban} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card card-pad lg:col-span-2">
          <SectionTitle>إنجاز المهام الأسبوعي</SectionTitle>
          <WeeklyCompletionChart tasks={tasks} />
        </div>
        <div className="card card-pad">
          <SectionTitle>توزيع الحالات</SectionTitle>
          <StatusPie tasks={tasks} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <SectionTitle action={<Link href="/analytics" className="meta hover:text-primary">التفاصيل</Link>}>عبء العمل حسب الفريق</SectionTitle>
          <WorkloadBars data={workload} />
        </div>
        <div className="card card-pad">
          <SectionTitle action={<Link href="/calendar" className="meta hover:text-primary">التقويم</Link>}>مواعيد قادمة</SectionTitle>
          <div className="mt-1 divide-y divide-outline-variant/40">
            {upcoming.length ? upcoming.map((t) => <TaskMiniRow key={t.id} task={t} />) : <EmptyState title="لا توجد مواعيد قريبة" icon={Clock} />}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card card-pad">
          <SectionTitle action={<Link href="/tasks?status=awaiting_review" className="meta hover:text-primary">الكل</Link>}>مهام بانتظار المراجعة</SectionTitle>
          <div className="mt-1 divide-y divide-outline-variant/40">
            {awaiting.length ? awaiting.slice(0, 5).map((t) => <TaskMiniRow key={t.id} task={t} />) : <EmptyState title="لا توجد مهام بانتظار المراجعة" icon={Hourglass} />}
          </div>
        </div>
        <div className="card card-pad">
          <SectionTitle action={<Link href="/tasks?status=blocked" className="meta hover:text-primary">الكل</Link>}>مهام متوقفة تحتاج انتباه</SectionTitle>
          <div className="mt-1 divide-y divide-outline-variant/40">
            {blocked.length ? blocked.slice(0, 5).map((t) => <TaskMiniRow key={t.id} task={t} />) : <EmptyState title="لا توجد مهام متوقفة" icon={ShieldAlert} />}
          </div>
        </div>
        <div className="card card-pad">
          <SectionTitle>أُنجزت مؤخراً</SectionTitle>
          <div className="mt-1 divide-y divide-outline-variant/40">
            {recentDone.length ? recentDone.map((t) => <TaskMiniRow key={t.id} task={t} />) : <EmptyState title="لا توجد مهام مكتملة بعد" icon={CheckCircle2} />}
          </div>
        </div>
      </section>

      {announcements.length > 0 && (
        <section className="card card-pad">
          <SectionTitle action={<Link href="/announcements" className="meta hover:text-primary">كل الإعلانات</Link>}>إعلانات مهمة</SectionTitle>
          <div className="mt-2 space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <Megaphone className="mt-0.5 h-4 w-4 text-secondary" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-on-surface">{a.title}</p>
                  <p className="meta">{userName(data, a.authorId)} · {fmtRelative(a.publishedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------------- TEAM LEADER ---------------- */

function LeaderOverview({ tasks }: { tasks: Task[] }) {
  const { currentUser, data } = useWorkspace();
  const u = currentUser!;
  const ledTeamId = u.leaderOfTeamIds[0];
  const team = ledTeamId ? getTeam(data, ledTeamId) : undefined;
  const members = ledTeamId ? membersOfTeam(data, ledTeamId) : [];
  const teamSharedTasks = tasks.filter((t) => t.assignmentType === "team_shared" && t.assignedTeamIds.includes(ledTeamId));
  const active = tasks.filter((t) => !["completed", "cancelled"].includes(t.status));
  const awaiting = tasks.filter((t) => t.status === "awaiting_review");
  const overdue = tasks.filter((t) => t.status === "overdue");
  const blocked = tasks.filter((t) => t.status === "blocked");

  const byMember = members.map((m) => ({
    name: m.name,
    value: tasks.filter((t) => (t.assignedUserIds.includes(m.id) || t.responsibleMemberIds.includes(m.id)) && !["completed", "cancelled"].includes(t.status)).length,
  }));

  return (
    <div className="space-y-6">
      <header className="card card-pad phoenix-motif">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={u.name} size={48} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-on-surface">{u.name}</h1>
                <LeaderBadge />
              </div>
              <p className="meta mt-0.5">{team?.name} · {members.length} أعضاء</p>
            </div>
          </div>
          <Link href={`/teams/${ledTeamId}`} className="btn-primary gap-2">
            <Users2 className="h-4 w-4" aria-hidden /> إدارة مهام الفريق
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="مهام الفريق النشطة" value={active.length} icon={ClipboardList} />
        <StatCard label="المهام المشتركة" value={teamSharedTasks.length} icon={Users2} />
        <StatCard label="مهام أعضاء الفريق" value={tasks.filter((t) => t.assignmentType === "individual").length} icon={ListChecks} />
        <StatCard label="المتأخرة" value={overdue.length} tone="error" icon={AlertTriangle} />
        <StatCard label="المتوقفة" value={blocked.length} tone="amber" icon={ShieldAlert} />
        <StatCard label="بانتظار مراجعتي" value={awaiting.length} tone="amber" icon={Hourglass} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <SectionTitle>عبء العمل حسب العضو</SectionTitle>
          <WorkloadBars data={byMember} />
        </div>
        <div className="card card-pad">
          <SectionTitle>إنجاز الفريق الأسبوعي</SectionTitle>
          <WeeklyCompletionChart tasks={tasks} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <SectionTitle action={<Link href="/team-tasks" className="meta hover:text-primary">الكل</Link>}>مهام الفريق المشتركة</SectionTitle>
          <div className="mt-1 divide-y divide-outline-variant/40">
            {teamSharedTasks.length ? teamSharedTasks.slice(0, 6).map((t) => <TaskMiniRow key={t.id} task={t} />) : <EmptyState title="لا توجد مهام مشتركة" icon={Users2} />}
          </div>
        </div>
        <div className="card card-pad">
          <SectionTitle>مهام بانتظار مراجعتي</SectionTitle>
          <div className="mt-1 divide-y divide-outline-variant/40">
            {awaiting.length ? awaiting.slice(0, 6).map((t) => <TaskMiniRow key={t.id} task={t} />) : <EmptyState title="لا شيء بانتظار المراجعة" icon={Hourglass} />}
          </div>
        </div>
      </section>

      <section className="card card-pad">
        <SectionTitle>المهام حسب العضو</SectionTitle>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => {
            const mt = tasks.filter((t) => t.assignedUserIds.includes(m.id) || t.responsibleMemberIds.includes(m.id));
            const isLeader = (team?.leaderIds ?? []).includes(m.id);
            return (
              <Link key={m.id} href={`/teams/${ledTeamId}?member=${m.id}`} className="card card-pad transition hover:border-primary/40">
                <div className="flex items-center gap-2">
                  <Avatar name={m.name} size={32} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      {isLeader && <LeaderBadge />}
                    </div>
                    <p className="meta">{mt.length} مهمة</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------------- MEMBER ---------------- */

function MemberOverview({ tasks }: { tasks: Task[] }) {
  const { currentUser } = useWorkspace();
  const u = currentUser!;
  const mine = myTasks(tasks, u.id);
  const team = teamTasks(tasks).filter((t) => !mine.some((x) => x.id === t.id));
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const week = new Date(); week.setDate(week.getDate() + 7);

  const dueToday = mine.filter((t) => new Date(t.dueDate) <= today && !["completed", "cancelled"].includes(t.status));
  const dueWeek = mine.filter((t) => { const d = new Date(t.dueDate); return d > today && d <= week && !["completed", "cancelled"].includes(t.status); });
  const inProgress = mine.filter((t) => t.status === "in_progress");
  const blocked = mine.filter((t) => t.status === "blocked");
  const overdue = mine.filter((t) => t.status === "overdue");
  const awaiting = mine.filter((t) => t.status === "awaiting_review");
  const doneRecent = mine.filter((t) => t.status === "completed").slice(0, 4);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">مرحباً {u.name}</h1>
        <p className="meta mt-1">إليك ملخص مهامك اليوم</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="مستحقة اليوم" value={dueToday.length} tone={dueToday.length ? "amber" : "default"} icon={Clock} />
        <StatCard label="هذا الأسبوع" value={dueWeek.length} icon={ListChecks} />
        <StatCard label="قيد التنفيذ" value={inProgress.length} tone="secondary" icon={Activity} />
        <StatCard label="متوقفة" value={blocked.length} tone="amber" icon={ShieldAlert} />
        <StatCard label="متأخرة" value={overdue.length} tone="error" icon={AlertTriangle} />
        <StatCard label="بانتظار المراجعة" value={awaiting.length} icon={Hourglass} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <SectionTitle action={<Link href="/my-tasks" className="meta hover:text-primary">كل مهامي</Link>}>مهامي</SectionTitle>
          <div className="mt-1 divide-y divide-outline-variant/40">
            {mine.length ? mine.slice(0, 7).map((t) => <TaskMiniRow key={t.id} task={t} />) : <EmptyState title="لا توجد مهام مسندة إليك حالياً" icon={ListChecks} />}
          </div>
        </div>
        <div className="card card-pad">
          <SectionTitle action={<Link href="/team-tasks" className="meta hover:text-primary">كل مهام الفريق</Link>}>مهام الفريق</SectionTitle>
          <div className="mt-1 divide-y divide-outline-variant/40">
            {team.length ? team.slice(0, 7).map((t) => <TaskMiniRow key={t.id} task={t} />) : <EmptyState title="لا توجد مهام فريق" icon={Users2} />}
          </div>
        </div>
      </section>

      {doneRecent.length > 0 && (
        <section className="card card-pad">
          <SectionTitle>مكتملة مؤخراً</SectionTitle>
          <div className="mt-1 divide-y divide-outline-variant/40">
            {doneRecent.map((t) => <TaskMiniRow key={t.id} task={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------------- VIEWER ---------------- */

function ViewerOverview({ tasks }: { tasks: Task[] }) {
  const c = countByStatus(tasks);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">نظرة عامة</h1>
        <p className="meta mt-1">وضع العرض للقراءة فقط</p>
      </header>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="إجمالي المهام المتاحة" value={tasks.length} icon={ClipboardList} />
        <StatCard label="مكتملة" value={c.completed} tone="secondary" icon={CheckCircle2} />
        <StatCard label="قيد التنفيذ" value={c.in_progress} icon={Activity} />
        <StatCard label="متأخرة" value={c.overdue} tone="error" icon={AlertTriangle} />
      </section>
      <div className="card card-pad">
        <SectionTitle>المهام</SectionTitle>
        <div className="mt-1 divide-y divide-outline-variant/40">
          {tasks.length ? tasks.slice(0, 12).map((t) => <TaskMiniRow key={t.id} task={t} />) : <EmptyState title="لا توجد بيانات متاحة" icon={ClipboardList} />}
        </div>
      </div>
    </div>
  );
}
