"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users2, ChevronLeft, Plus, ClipboardList, Trash2, UserPlus, X, Search, Pencil, ShieldCheck, ShieldMinus } from "lucide-react";
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
  const { currentUser, data, deleteTeam, updateTeam, addTeamMembers, removeTeamMember, setTeamLeadership } = useWorkspace();
  const [memberFilter, setMemberFilter] = useState<string | null>(params.get("member"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [addAsLeader, setAddAsLeader] = useState(false);
  const [search, setSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const visible = useMemo(() => (currentUser ? tasksFor(data, currentUser) : []), [data, currentUser]);
  if (!currentUser) return null;
  const team = data.teams.find((t) => t.id === id);
  if (!team) return <div className="card card-pad"><EmptyState title="الفريق غير موجود" icon={Users2} /></div>;

  if (!canSeeTeam(currentUser, team)) {
    return <div className="card card-pad"><EmptyState title="غير مصرح" hint="لا تملك صلاحية عرض هذا الفريق." icon={Users2} /></div>;
  }

  const canManage = isElevated(currentUser) || currentUser.leaderOfTeamIds.includes(team.id);
  const members = membersOfTeam(data, team.id);
  const candidates = data.users
    .filter((u) => !team.memberIds.includes(u.id) && u.accountStatus !== "suspended")
    .filter((u) => {
      const q = search.trim().toLowerCase();
      return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });

  const togglePicked = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const closeAddMember = () => {
    setShowAddMember(false);
    setPicked([]);
    setAddAsLeader(false);
    setSearch("");
  };

  const confirmAddMembers = () => {
    if (picked.length === 0) return;
    addTeamMembers(team.id, picked, addAsLeader);
    closeAddMember();
  };

  const elevated = isElevated(currentUser);

  const openEdit = () => {
    setEditName(team.name);
    setEditDesc(team.description ?? "");
    setShowEdit(true);
  };

  const confirmEdit = () => {
    if (editName.trim().length < 2) return;
    updateTeam(team.id, { name: editName, description: editDesc });
    setShowEdit(false);
  };
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
          {canManage && <button onClick={openEdit} className="btn-outline gap-2"><Pencil className="h-4 w-4" /> تعديل</button>}
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
          <SectionTitle
            action={canManage ? (
              <button onClick={() => setShowAddMember(true)} className="btn-ghost gap-1 text-primary"><UserPlus className="h-4 w-4" /> إضافة عضو</button>
            ) : undefined}
          >
            أعضاء الفريق
          </SectionTitle>
          <div className="mt-2 space-y-1">
            <button onClick={() => setMemberFilter(null)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right transition ${!memberFilter ? "bg-primary/5" : "hover:bg-surface-container-low"}`}>
              <span className="text-sm font-medium text-on-surface">كل الأعضاء</span>
            </button>
            {members.map((m) => {
              const isLeader = team.leaderIds.includes(m.id);
              const sel = memberFilter === m.id;
              return (
                <div key={m.id} className={`group flex items-center gap-1 rounded-lg pl-1 transition ${sel ? "bg-primary/5" : "hover:bg-surface-container-low"}`}>
                  <button onClick={() => setMemberFilter(m.id)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-right">
                    <Avatar name={m.name} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5"><span className="truncate text-sm text-on-surface">{m.name}</span>{isLeader && <LeaderBadge />}</span>
                    </span>
                  </button>
                  {elevated && (
                    <button
                      onClick={() => setTeamLeadership(team.id, m.id, !isLeader)}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${isLeader ? "text-primary hover:bg-primary/10" : "text-on-surface-variant/60 hover:bg-surface-container hover:text-primary"}`}
                      aria-label={isLeader ? `إزالة ${m.name} من قيادة الفريق` : `تعيين ${m.name} قائداً للفريق`}
                      title={isLeader ? "إزالة من القيادة" : "تعيين قائداً"}
                    >
                      {isLeader ? <ShieldMinus className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => setRemoveTarget(m.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-on-surface-variant/60 transition hover:bg-error/10 hover:text-error"
                      aria-label={`إزالة ${m.name} من الفريق`}
                      title="إزالة من الفريق"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
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

      <ConfirmDialog
        open={!!removeTarget}
        title="إزالة من الفريق"
        message={removeTarget ? `سيتم إزالة "${userName(data, removeTarget)}" من فريق "${team.name}". يبقى الحساب موجوداً ويمكن إعادته لاحقاً.` : ""}
        confirmLabel="نعم، أزل"
        onConfirm={() => { if (removeTarget) removeTeamMember(team.id, removeTarget); setRemoveTarget(null); }}
        onCancel={() => setRemoveTarget(null)}
      />

      {showEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-card bg-surface-container-lowest p-5 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-on-surface">تعديل الفريق</h3>
              <button onClick={() => setShowEdit(false)} className="btn-ghost p-1" aria-label="إغلاق"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <label className="label">اسم الفريق</label>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="label">الوصف</label>
                <textarea rows={3} className="input resize-none" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button disabled={editName.trim().length < 2} onClick={confirmEdit} className="btn-primary disabled:opacity-50">حفظ</button>
                <button onClick={() => setShowEdit(false)} className="btn-ghost">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-card bg-surface-container-lowest p-5 shadow-xl animate-fade-in">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-on-surface">إضافة عضو إلى {team.name}</h3>
                <p className="meta mt-1 normal-case tracking-normal text-on-surface-variant">اختر الأعضاء لإضافتهم إلى الفريق.</p>
              </div>
              <button onClick={closeAddMember} className="btn-ghost p-1.5" aria-label="إغلاق"><X className="h-4 w-4" /></button>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو البريد الإلكتروني"
                className="input w-full pr-9"
              />
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
              {candidates.length === 0 ? (
                <EmptyState title="لا يوجد أعضاء لإضافتهم" hint="كل المستخدمين المتاحين أعضاء في هذا الفريق بالفعل." icon={Users2} />
              ) : (
                candidates.map((u) => {
                  const sel = picked.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => togglePicked(u.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right transition ${sel ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-surface-container-low"}`}
                    >
                      <Avatar name={u.name} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-on-surface">{u.name}</span>
                        <span className="block truncate text-xs text-on-surface-variant">{u.email}</span>
                      </span>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${sel ? "border-primary bg-primary text-white" : "border-outline-variant"}`}>
                        {sel && <Plus className="h-3 w-3 rotate-45" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {isElevated(currentUser) && (
              <label className="mt-3 flex items-center gap-2 text-sm text-on-surface">
                <input type="checkbox" checked={addAsLeader} onChange={(e) => setAddAsLeader(e.target.checked)} />
                تعيينهم كقادة للفريق
              </label>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={confirmAddMembers} disabled={picked.length === 0} className="btn-primary gap-1 disabled:opacity-50">
                <UserPlus className="h-4 w-4" /> إضافة{picked.length ? ` (${picked.length})` : ""}
              </button>
              <button onClick={closeAddMember} className="btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
