"use client";

import { useMemo } from "react";
import { BarChart3, Users2, User2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { isElevated, can } from "@/lib/permissions";
import { tasksFor, tasksOfTeam, completionRate, onTimeRate, countByStatus } from "@/lib/selectors";
import { StatCard, SectionTitle, EmptyState } from "@/components/ui";
import { WeeklyCompletionChart, StatusPie, WorkloadBars } from "@/components/Charts";
import { statusAr } from "@/lib/arabic";
import type { TaskStatus } from "@/lib/types";

export default function AnalyticsPage() {
  const { currentUser, data } = useWorkspace();
  const tasks = useMemo(() => (currentUser ? tasksFor(data, currentUser) : []), [data, currentUser]);

  if (!currentUser) return null;
  if (!can(currentUser, "access_analytics")) {
    return <div className="card card-pad text-center"><EmptyState title="غير مصرح" hint="التحليلات متاحة للمدراء وقادة الفرق." icon={BarChart3} /></div>;
  }
  const personal = tasks.filter((t) => t.assignmentType === "individual" || t.assignmentType === "multiple_members_shared" || t.parentAssignmentId);
  const team = tasks.filter((t) => t.assignmentType === "team_shared");
  const counts = countByStatus(tasks);

  const teamsToShow = isElevated(currentUser) ? data.teams : data.teams.filter((t) => currentUser.leaderOfTeamIds.includes(t.id));
  const workload = teamsToShow.map((t) => ({
    name: t.name,
    value: tasksOfTeam(tasks, t.id, data.users).filter((task) => !["completed", "cancelled"].includes(task.status)).length,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">التحليلات</h1>
        <p className="meta mt-1">مؤشرات الأداء — مع الفصل بين المهام الشخصية ومهام الفرق</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="إجمالي المهام" value={tasks.length} icon={BarChart3} />
        <StatCard label="معدل الإنجاز" value={`${completionRate(tasks)}٪`} tone="secondary" icon={CheckCircle2} />
        <StatCard label="الإنجاز في الموعد" value={`${onTimeRate(tasks)}٪`} tone="secondary" icon={Clock} />
        <StatCard label="المتأخرة" value={counts.overdue} tone="error" icon={AlertTriangle} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <SectionTitle><span className="flex items-center gap-2"><User2 className="h-4 w-4" /> المهام الشخصية</span></SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="العدد" value={personal.length} />
            <StatCard label="الإنجاز" value={`${completionRate(personal)}٪`} tone="secondary" />
            <StatCard label="في الموعد" value={`${onTimeRate(personal)}٪`} tone="secondary" />
          </div>
        </div>
        <div className="card card-pad">
          <SectionTitle><span className="flex items-center gap-2"><Users2 className="h-4 w-4" /> مهام الفرق المشتركة</span></SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="العدد" value={team.length} />
            <StatCard label="الإنجاز" value={`${completionRate(team)}٪`} tone="secondary" />
            <StatCard label="في الموعد" value={`${onTimeRate(team)}٪`} tone="secondary" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card card-pad lg:col-span-2">
          <SectionTitle>الإنجاز الأسبوعي</SectionTitle>
          <WeeklyCompletionChart tasks={tasks} />
        </div>
        <div className="card card-pad">
          <SectionTitle>توزيع الحالات</SectionTitle>
          <StatusPie tasks={tasks} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <SectionTitle>عبء العمل حسب الفريق</SectionTitle>
          {workload.length ? <WorkloadBars data={workload} /> : <EmptyState title="لا بيانات" icon={Users2} />}
        </div>
        <div className="card card-pad">
          <SectionTitle>تفصيل الحالات</SectionTitle>
          <div className="mt-2 space-y-2">
            {(Object.keys(counts) as TaskStatus[]).map((s) => {
              const total = tasks.length || 1;
              const v = counts[s];
              return (
                <div key={s}>
                  <div className="mb-0.5 flex justify-between text-sm"><span className="text-on-surface-variant">{statusAr[s]}</span><span className="font-mono text-on-surface">{v}</span></div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / total) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
