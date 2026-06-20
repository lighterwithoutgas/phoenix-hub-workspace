"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users2, ChevronLeft, Plus, ClipboardList, Trash2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { canSeeTeam, isElevated } from "@/lib/permissions";
import { membersOfTeam, tasksOfTeam, tasksFor, userName, completionRate } from "@/lib/selectors";
import { Avatar, LeaderBadge, StatCard, SectionTitle, EmptyState, ConfirmDialog } from "@/components/ui";
import { TaskCard } from "@/components/TaskList";
import { WorkloadBars } from "@/components/Charts";

export default function TeamDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { currentUser, data, deleteTeam } = useWorkspace();
  const [memberFilter, setMemberFilter] = useState<string | null>(params.get("member"));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const visible = useMemo(() => (currentUser ? tasksFor(data, currentUser) : []), [data, currentUser]);
  if (!currentUser) return null;
  const team = data.teams.find((t) => t.id === id);
  if (!team) return <div className="card card-pad"><EmptyState title="الفريق غير موجود" icon={Users2} /></div>;

  if (!canSeeTeam(currentUser, team)) {
    return <div className="card card-pad"><EmptyState title="غير مصرح" hint="لا تملك صلاحية عرض هذا الفريق." icon={Users2} /></div>;
  }

  const canManage = isElevated(currentUser) || currentUser.leaderOfTeamIds.includes(team.id);
  const members = membersOfTeam(data, team.id);
  const teamTasks = tasksOfTeam(visible, team.id, data.users);
  const sharedTasks = teamTasks.filter((t) => t.assignmentType === "team_shared");
  const memberTasks = teamTasks.filter((t) => t.assignmentType !== "team_shared");

  const shown = memberFilter
    ? teamTasks.filter((t) => t.assignedUserIds.includes(memberFilter) || t.responsibleMemberIds.includes(memberFilter))
    : teamTasks;

  const byMember = members.map((m) => ({
    name: m.name,
    value: teamTasks.filter((t) => (t.assignedUserIds.includes(m.id) || t.responsibleMemberIds.includes(m.id)) && !["completed", "cancelled"].includes(t.status)).length,
  }));

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <Link href="/teams" className="btn-ghost gap-1"><ChevronLeft className="h-4 w-4" /> كل الفرق</Link>
        <div className="flex items-center gap-2">
          {canManage && <Link href="/tasks/new?type=team_shared" className="btn-primary gap-2"><Plus className="h-4 w-4" /> إدارة مهام الفريق</Link>}
          {isElevated(currentUser) && <button onClick={() => setConfirmDelete(true)} className="btn-outline gap-2 border-error/40 text-error hover:bg-error/10"><Trash2 className="h-4 w-4" /> حذف الفريق</button>}
        </div>
      </header>

      <div className="card card-pad phoenix-motif">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-card bg-primary/10 text-primary"><Users2 className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold text-on-surface">{team.name}</h1>
            <p className="meta">{team.description}</p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="الأعضاء" value={members.length} icon={Users2} />
        <StatCard label="مهام مشتركة" value={sharedTasks.length} icon={Users2} />
        <StatCard label="مهام الأعضاء" value={memberTasks.length} icon={ClipboardList} />
        <StatCard label="معدل الإنجاز" value={`${completionRate(teamTasks)}٪`} tone="secondary" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card card-pad">
          <SectionTitle>أعضاء الفريق</SectionTitle>
          <div className="mt-2 space-y-1">
            <button onClick={() => setMemberFilter(null)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right transition ${!memberFilter ? "bg-primary/5" : "hover:bg-surface-container-low"}`}>
              <span className="text-sm font-medium text-on-surface">كل الأعضاء</span>
            </button>
            {members.map((m) => {
              const isLeader = team.leaderIds.includes(m.id);
              const sel = memberFilter === m.id;
              return (
                <button key={m.id} onClick={() => setMemberFilter(m.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right transition ${sel ? "bg-primary/5" : "hover:bg-surface-container-low"}`}>
                  <Avatar name={m.name} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5"><span className="truncate text-sm text-on-surface">{m.name}</span>{isLeader && <LeaderBadge />}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card card-pad lg:col-span-2">
          <SectionTitle>عبء العمل حسب العضو</SectionTitle>
          <WorkloadBars data={byMember} />
        </div>
      </section>

      <section>
        <SectionTitle>{memberFilter ? `مهام ${userName(data, memberFilter)}` : "مهام الفريق"}</SectionTitle>
        {shown.length ? (
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {shown.map((t) => <TaskCard key={t.id} task={t} data={data} />)}
          </div>
        ) : <EmptyState title="لا توجد مهام" icon={ClipboardList} />}
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف الفريق"
        message={`سيتم حذف "${team.name}". المهام المشتركة الخاصة به فقط ستُحذف، ومهام الأعضاء الفردية تبقى. لا يمكن التراجع.`}
        confirmLabel="نعم، احذف"
        onConfirm={() => { deleteTeam(team.id); router.push("/teams"); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
