"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Users2, Plus, X, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { isElevated, visibleTeamIds, teamLeaderNames } from "@/lib/permissions";
import { membersOfTeam, tasksOfTeam, tasksFor, completionRate } from "@/lib/selectors";
import { isDelayed } from "@/lib/utils";
import { Avatar, LeaderBadge, EmptyState } from "@/components/ui";

export default function TeamsPage() {
  const { currentUser, data, createTeam } = useWorkspace();
  const params = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (currentUser && isElevated(currentUser) && params.get("create") === "1") setShowCreate(true);
  }, [params, currentUser]);

  const visibleTasks = useMemo(() => (currentUser ? tasksFor(data, currentUser) : []), [data, currentUser]);
  if (!currentUser) return null;
  const allowed = visibleTeamIds(currentUser);
  const teams = allowed.includes("*") ? data.teams : data.teams.filter((t) => allowed.includes(t.id) || currentUser.teamIds.includes(t.id));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">الفرق</h1>
          <p className="meta mt-1">فرق Phoenix Hub ومسؤولياتها</p>
        </div>
        {isElevated(currentUser) && <button onClick={() => setShowCreate(true)} className="btn-primary gap-2"><Plus className="h-4 w-4" /> إنشاء فريق</button>}
      </header>

      {teams.length === 0 ? (
        <EmptyState title="لا توجد فرق متاحة" icon={Users2} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => {
            const members = membersOfTeam(data, team.id);
            const tt = tasksOfTeam(visibleTasks, team.id, data.users);
            const active = tt.filter((t) => !["completed", "cancelled"].includes(t.status));
            const overdue = tt.filter((t) => isDelayed(t));
            const leaderNames = teamLeaderNames(team, data.users);
            return (
              <Link key={team.id} href={`/teams/${team.id}`} className="card card-pad phoenix-motif transition hover:border-primary/40">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-card bg-primary/10 text-primary"><Users2 className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-on-surface">{team.name}</h3>
                    {leaderNames.length > 0 && (
                      <p className="meta flex items-center gap-1.5">
                        {leaderNames.length > 1 ? "القادة" : "القائد"}: {leaderNames[0]}{leaderNames.length > 1 ? ` +${leaderNames.length - 1}` : ""} <LeaderBadge />
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{team.description}</p>
                <div className="mt-3 flex -space-x-2 space-x-reverse">
                  {members.slice(0, 5).map((m) => <div key={m.id} className="ring-2 ring-surface-container-lowest rounded-full"><Avatar name={m.name} size={28} /></div>)}
                  {members.length > 5 && <div className="grid h-7 w-7 place-items-center rounded-full bg-surface-container text-xs text-on-surface-variant ring-2 ring-surface-container-lowest">+{members.length - 5}</div>}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <Stat label="أعضاء" value={members.length} />
                  <Stat label="نشطة" value={active.length} />
                  <Stat label="متأخرة" value={overdue.length} tone="error" />
                  <Stat label="الإنجاز" value={`${completionRate(tt)}٪`} tone="secondary" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {isElevated(currentUser) && showCreate && (
        <CreateTeamDialog
          users={data.users.filter((u) => u.accountStatus === "active")}
          onClose={() => setShowCreate(false)}
          onCreate={(input) => { createTeam(input); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "error" | "secondary" }) {
  const c = tone === "error" ? "text-error" : tone === "secondary" ? "text-secondary" : "text-on-surface";
  return (
    <div className="rounded-lg bg-surface-container-low py-1.5">
      <p className={`font-mono text-sm font-bold ${c}`}>{value}</p>
      <p className="text-[11px] text-on-surface-variant">{label}</p>
    </div>
  );
}

function CreateTeamDialog({
  users, onClose, onCreate,
}: {
  users: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (input: { name: string; description: string; memberIds: string[]; leaderId?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState<string>("");

  const toggle = (id: string) => setMemberIds((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-on-surface">إنشاء فريق</h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 space-y-3">
          <div><label className="label">اسم الفريق</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: فريق الفعاليات" /></div>
          <div><label className="label">الوصف</label><textarea rows={2} className="input resize-none" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div>
            <label className="label">الأعضاء</label>
            <div className="grid grid-cols-2 gap-2">
              {users.map((u) => {
                const sel = memberIds.includes(u.id);
                return (
                  <button type="button" key={u.id} onClick={() => toggle(u.id)} className={`flex items-center gap-2 rounded-card border p-2 text-right transition ${sel ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary/40"}`}>
                    <Avatar name={u.name} size={26} />
                    <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{u.name}</span>
                    {sel && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
          {memberIds.length > 0 && (
            <div>
              <label className="label flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> قائد الفريق (اختياري)</label>
              <select className="input" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
                <option value="">بدون قائد محدد</option>
                {users.filter((u) => memberIds.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button disabled={name.length < 2} onClick={() => onCreate({ name, description: desc, memberIds, leaderId: leaderId || undefined })} className="btn-primary disabled:opacity-50">إنشاء الفريق</button>
            <button onClick={onClose} className="btn-ghost">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}
