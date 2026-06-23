"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Megaphone, Plus, X, Check, CheckCheck, Trash2, Pencil } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { can, canManageAnnouncement, canSeeAnnouncement, isElevated } from "@/lib/permissions";
import { userName } from "@/lib/selectors";
import { PriorityBadge, EmptyState, ConfirmDialog } from "@/components/ui";
import { fmtRelative, priorityAr } from "@/lib/arabic";
import type { Announcement, TaskPriority } from "@/lib/types";

export default function AnnouncementsPage() {
  const { currentUser, data, createAnnouncement, updateAnnouncement, acknowledgeAnnouncement, deleteAnnouncement } = useWorkspace();
  const params = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [editAnn, setEditAnn] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => { if (params.get("create") === "1") setShowCreate(true); }, [params]);

  if (!currentUser) return null;
  const canManage = can(currentUser, "manage_announcements");
  const sorted = data.announcements
    .filter((announcement) => canSeeAnnouncement(currentUser, announcement))
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const audienceTeams = isElevated(currentUser)
    ? data.teams
    : data.teams.filter((team) => currentUser.leaderOfTeamIds.includes(team.id));
  const target = confirmDelete ? data.announcements.find((a) => a.id === confirmDelete) : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">الإعلانات</h1>
          <p className="meta mt-1">إعلانات وتعميمات Phoenix Hub</p>
        </div>
        {canManage && <button onClick={() => setShowCreate(true)} className="btn-primary gap-2"><Plus className="h-4 w-4" /> نشر إعلان</button>}
      </header>

      {sorted.length === 0 ? <EmptyState title="لا توجد إعلانات" icon={Megaphone} /> : (
        <div className="space-y-3">
          {sorted.map((a) => {
            const acked = a.acknowledgedBy.includes(currentUser.id);
            return (
              <article key={a.id} className="card card-pad phoenix-motif">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-secondary/10 text-secondary"><Megaphone className="h-5 w-5" /></div>
                    <div>
                      <h3 className="font-bold text-on-surface">{a.title}</h3>
                      <p className="meta">{userName(data, a.authorId)} · {fmtRelative(a.publishedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={a.priority} />
                    {canManageAnnouncement(currentUser, a) && <button onClick={() => setEditAnn(a)} className="text-on-surface-variant transition hover:text-primary" aria-label="تعديل الإعلان"><Pencil className="h-4 w-4" /></button>}
                    {canManageAnnouncement(currentUser, a) && <button onClick={() => setConfirmDelete(a.id)} className="text-on-surface-variant transition hover:text-error" aria-label="حذف الإعلان"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">{a.body}</p>
                {a.requireAck && (
                  <div className="mt-3 flex items-center justify-between border-t border-outline-variant/40 pt-3">
                    <span className="meta">{a.acknowledgedBy.length} أقرّوا بالاطلاع</span>
                    {acked ? (
                      <span className="badge bg-secondary/10 text-secondary"><CheckCheck className="ml-1 inline h-3.5 w-3.5" /> تم الإقرار</span>
                    ) : (
                      <button onClick={() => acknowledgeAnnouncement(a.id)} className="btn-outline gap-1 py-1.5"><Check className="h-4 w-4" /> إقرار بالاطلاع</button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {canManage && showCreate && (
        <AnnouncementDialog
          teams={audienceTeams}
          allowAll={isElevated(currentUser)}
          onClose={() => setShowCreate(false)}
          onSubmit={(input) => { createAnnouncement(input); setShowCreate(false); }}
        />
      )}

      {editAnn && canManageAnnouncement(currentUser, editAnn) && (
        <AnnouncementDialog
          teams={audienceTeams}
          allowAll={isElevated(currentUser)}
          initial={editAnn}
          onClose={() => setEditAnn(null)}
          onSubmit={(input) => { updateAnnouncement(editAnn.id, input); setEditAnn(null); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف الإعلان"
        message={target ? `سيتم حذف الإعلان "${target.title}" نهائياً.` : ""}
        confirmLabel="نعم، احذف"
        onConfirm={() => { if (confirmDelete) deleteAnnouncement(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function AnnouncementDialog({
  teams, allowAll, initial, onClose, onSubmit,
}: {
  teams: { id: string; name: string }[];
  allowAll: boolean;
  initial?: Announcement;
  onClose: () => void;
  onSubmit: (input: { title: string; body: string; priority: TaskPriority; audienceType: "all" | "teams"; audienceIds: string[]; requireAck: boolean }) => void;
}) {
  const isEdit = !!initial;
  const initialType: "all" | "teams" = initial ? (initial.audience.type === "all" ? "all" : "teams") : allowAll ? "all" : "teams";
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "medium");
  const [audienceType, setAudienceType] = useState<"all" | "teams">(initialType);
  const [audienceIds, setAudienceIds] = useState<string[]>(initial ? initial.audience.ids : allowAll ? [] : teams[0]?.id ? [teams[0].id] : []);
  const [requireAck, setRequireAck] = useState(initial?.requireAck ?? false);
  const canPublish = title.length >= 2 && body.length >= 1 && (audienceType === "all" || audienceIds.length > 0);
  const toggle = (id: string) => setAudienceIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-on-surface">{isEdit ? "تعديل الإعلان" : "نشر إعلان"}</h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 space-y-3">
          <div><label className="label">العنوان</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإعلان" /></div>
          <div><label className="label">المحتوى</label><textarea rows={4} className="input resize-none" value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">الأولوية</label>
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => <option key={p} value={p}>{priorityAr[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الجمهور</label>
              <select className="input" value={audienceType} onChange={(e) => setAudienceType(e.target.value as "all" | "teams")}>
                {allowAll && <option value="all">الجميع</option>}
                <option value="teams">فرق محددة</option>
              </select>
            </div>
          </div>
          {audienceType === "teams" && (
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => {
                const sel = audienceIds.includes(t.id);
                return <button type="button" key={t.id} onClick={() => toggle(t.id)} className={`badge cursor-pointer ${sel ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>{t.name}</button>;
              })}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-on-surface"><input type="checkbox" checked={requireAck} onChange={(e) => setRequireAck(e.target.checked)} className="h-4 w-4 accent-primary" /> يتطلب إقراراً بالاطلاع</label>
          <div className="flex justify-end gap-2 pt-1">
            <button disabled={!canPublish} onClick={() => onSubmit({ title, body, priority, audienceType, audienceIds, requireAck })} className="btn-primary disabled:opacity-50">{isEdit ? "حفظ" : "نشر"}</button>
            <button onClick={onClose} className="btn-ghost">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}
