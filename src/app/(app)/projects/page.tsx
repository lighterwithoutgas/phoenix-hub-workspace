"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FolderKanban, Plus, X, Trash2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { isElevated } from "@/lib/permissions";
import { tasksFor, userName, getTeam } from "@/lib/selectors";
import { ProgressBar, EmptyState, StatusBadge, PriorityBadge, ConfirmDialog } from "@/components/ui";
import { projectStatusAr, priorityAr, fmtDate } from "@/lib/arabic";
import type { TaskPriority } from "@/lib/types";

export default function ProjectsPage() {
  const { currentUser, data, createProject, deleteProject } = useWorkspace();
  const params = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => {
    if (currentUser && isElevated(currentUser) && params.get("create") === "1") setShowCreate(true);
  }, [params, currentUser]);

  const visible = useMemo(() => (currentUser ? tasksFor(data, currentUser) : []), [data, currentUser]);
  if (!currentUser) return null;
  const target = confirmDelete ? data.projects.find((p) => p.id === confirmDelete) : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">المشاريع</h1>
          <p className="meta mt-1">مبادرات Phoenix Hub والمهام المرتبطة بها</p>
        </div>
        {isElevated(currentUser) && <button onClick={() => setShowCreate(true)} className="btn-primary gap-2"><Plus className="h-4 w-4" /> إنشاء مشروع</button>}
      </header>

      {data.projects.length === 0 ? <EmptyState title="لا توجد مشاريع" icon={FolderKanban} /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.projects.map((p) => {
            const linked = visible.filter((t) => t.projectId === p.id);
            const teams = p.teamIds.map((id) => getTeam(data, id)?.name).filter(Boolean);
            return (
              <div key={p.id} className="card card-pad phoenix-motif">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-card bg-secondary/10 text-secondary"><FolderKanban className="h-5 w-5" /></div>
                    <div>
                      <h3 className="font-bold text-on-surface">{p.name}</h3>
                      <p className="meta">{teams.join("، ") || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end gap-1">
                      <span className="badge bg-primary/10 text-primary">{projectStatusAr[p.status]}</span>
                      <PriorityBadge priority={p.priority} />
                    </div>
                    {isElevated(currentUser) && (
                      <button onClick={() => setConfirmDelete(p.id)} className="text-on-surface-variant transition hover:text-error" aria-label="حذف المشروع"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{p.description}</p>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-sm"><span className="text-on-surface-variant">التقدم</span><span className="font-mono text-on-surface">{p.progress}٪</span></div>
                  <ProgressBar value={p.progress} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="meta">المدير: {userName(data, p.managerId)}</span>
                  <span className="meta" dir="ltr">{fmtDate(p.startDate)} → {p.endDate ? fmtDate(p.endDate) : "—"}</span>
                </div>
                {linked.length > 0 && (
                  <div className="mt-3 border-t border-outline-variant/40 pt-3">
                    <p className="label mb-2">مهام مرتبطة ({linked.length})</p>
                    <div className="space-y-1">
                      {linked.slice(0, 4).map((t) => (
                        <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm hover:bg-surface-container-low">
                          <span className="truncate text-on-surface">{t.title}</span>
                          <StatusBadge status={t.status} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isElevated(currentUser) && showCreate && (
        <CreateProjectDialog
          teams={data.teams}
          onClose={() => setShowCreate(false)}
          onCreate={(input) => { createProject(input); setShowCreate(false); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف المشروع"
        message={target ? `سيتم حذف "${target.name}". المهام المرتبطة لن تُحذف، لكن سيُلغى ربطها بالمشروع.` : ""}
        confirmLabel="نعم، احذف"
        onConfirm={() => { if (confirmDelete) deleteProject(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function CreateProjectDialog({
  teams, onClose, onCreate,
}: {
  teams: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (input: { name: string; description: string; teamIds: string[]; startDate?: string; endDate?: string; priority: TaskPriority }) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const toggle = (id: string) => setTeamIds((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-on-surface">إنشاء مشروع</h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 space-y-3">
          <div><label className="label">اسم المشروع</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: حملة الصيف" /></div>
          <div><label className="label">الوصف</label><textarea rows={2} className="input resize-none" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div>
            <label className="label">الفرق المشاركة</label>
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => {
                const sel = teamIds.includes(t.id);
                return <button type="button" key={t.id} onClick={() => toggle(t.id)} className={`badge cursor-pointer ${sel ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>{t.name}</button>;
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">تاريخ البدء</label><input type="date" dir="ltr" className="input" value={startDate} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label className="label">تاريخ الانتهاء</label><input type="date" dir="ltr" className="input" value={endDate} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div>
            <label className="label">الأولوية</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => <option key={p} value={p}>{priorityAr[p]}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button disabled={name.length < 2} onClick={() => onCreate({ name, description: desc, teamIds, startDate, endDate, priority })} className="btn-primary disabled:opacity-50">إنشاء</button>
            <button onClick={onClose} className="btn-ghost">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}
