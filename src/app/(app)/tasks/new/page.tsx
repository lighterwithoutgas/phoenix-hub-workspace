"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User2, Users, Users2, Copy, CheckCircle2, ChevronLeft, Info, X, Link2, Plus,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { taskSchema, type TaskInput } from "@/lib/schemas";
import { can } from "@/lib/permissions";
import { getTeam, membersOfTeam, userName } from "@/lib/selectors";
import { assignmentAr, priorityAr } from "@/lib/arabic";
import { LeaderBadge, Avatar } from "@/components/ui";
import type { AssignmentType, TaskPriority, WorkspaceData } from "@/lib/types";

const TYPE_META: Record<AssignmentType, { icon: React.ElementType; hint: string }> = {
  individual: { icon: User2, hint: "تُسند إلى عضو واحد محدد." },
  multiple_members_shared: { icon: Users, hint: "مهمة واحدة مشتركة بين عدة أعضاء بحالة وتقدم موحّد." },
  team_shared: { icon: Users2, hint: "تُسند إلى فريق كامل — يبقى الفريق هو المسؤول الرسمي." },
  team_member_copies: { icon: Copy, hint: "تُنشأ نسخة مستقلة لكل عضو في الفريق، لكل نسخة حالتها." },
};

export default function NewTaskPage() {
  const { currentUser, data, createTask } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [previewValues, setPreviewValues] = useState<TaskInput | null>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const presetType = (params.get("type") as AssignmentType) || "individual";

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "", description: "", assignmentType: presetType,
      assignedUserIds: [], assignedTeamIds: [], responsibleMemberIds: [],
      priority: "medium", dueDate: "", tags: [], attachmentUrls: [],
      approvalRequired: false, proofRequired: false,
    },
  });

  const type = watch("assignmentType");
  const selectedTeam = watch("assignedTeamIds")[0];
  const selectedUsers = watch("assignedUserIds");
  const responsible = watch("responsibleMemberIds");

  // candidate members: team_leader limited to their teams
  const candidateUsers = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "team_leader") {
      const ids = new Set(currentUser.leaderOfTeamIds.flatMap((tid) => getTeam(data, tid)?.memberIds ?? []));
      return data.users.filter((u) => ids.has(u.id) && u.accountStatus === "active");
    }
    return data.users.filter((u) => u.accountStatus === "active" && u.role !== "viewer");
  }, [data, currentUser]);

  const candidateTeams = useMemo(() => {
    if (!currentUser) return data.teams;
    if (currentUser.role === "team_leader") return data.teams.filter((t) => currentUser.leaderOfTeamIds.includes(t.id));
    return data.teams;
  }, [data, currentUser]);

  if (!currentUser) return null;
  if (!can(currentUser, "create_tasks")) {
    return (
      <div className="card card-pad text-center">
        <p className="text-on-surface">لا تملك صلاحية إنشاء المهام.</p>
      </div>
    );
  }

  const teamMembers = selectedTeam ? membersOfTeam(data, selectedTeam) : [];
  const teamObj = selectedTeam ? getTeam(data, selectedTeam) : undefined;

  const normalizeLink = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      // eslint-disable-next-line no-new
      new URL(normalized);
      return normalized;
    } catch {
      return null;
    }
  };

  const mergeDraftLink = (baseLinks: string[]): string[] | null => {
    const normalized = normalizeLink(linkDraft);
    if (normalized === null) {
      setLinkError("رابط غير صالح");
      return null;
    }
    if (!normalized) return baseLinks;
    setLinkError(null);
    setLinkDraft("");
    return baseLinks.includes(normalized) ? baseLinks : [...baseLinks, normalized];
  };

  const onConfirm = handleSubmit((values) => {
    const nextLinks = mergeDraftLink(values.attachmentUrls);
    if (!nextLinks) return;
    const nextValues = { ...values, attachmentUrls: nextLinks };
    setValue("attachmentUrls", nextLinks, { shouldValidate: true });
    setPreviewValues(nextValues);
    setConfirming(true);
  });

  const finalize = (addAnother: boolean) => {
    const values = previewValues ?? watch();
    const created = createTask(values);
    if (created && created.length) {
      if (addAnother) {
        reset({
          title: "", description: "", assignmentType: type,
          assignedUserIds: [], assignedTeamIds: [], responsibleMemberIds: [],
          priority: "medium", dueDate: "", tags: [], attachmentUrls: [], approvalRequired: false, proofRequired: false,
        });
        setConfirming(false);
        setPreviewValues(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setDone(created[0].id);
      }
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card card-pad text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-secondary" aria-hidden />
          <h2 className="mt-3 text-lg font-bold text-on-surface">تم إنشاء المهمة بنجاح</h2>
          <p className="meta mt-1">تم إرسال الإشعارات إلى المستلمين المعنيين.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => router.push(`/tasks/${done}`)} className="btn-primary">فتح المهمة</button>
            <button onClick={() => { setDone(null); reset(); }} className="btn-outline">إنشاء مهمة أخرى</button>
            <button onClick={() => router.push("/overview")} className="btn-ghost">الرئيسية</button>
          </div>
        </div>
      </div>
    );
  }

  const toggleArray = (field: "assignedUserIds" | "responsibleMemberIds", id: string) => {
    const cur = watch(field);
    setValue(field, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id], { shouldValidate: true });
  };

  const links = watch("attachmentUrls");

  const addLink = () => {
    const normalized = normalizeLink(linkDraft);
    if (!normalized) {
      if (normalized === null) setLinkError("رابط غير صالح");
      return;
    }
    if (links.includes(normalized)) {
      setLinkError("الرابط مضاف مسبقاً");
      return;
    }
    setValue("attachmentUrls", [...links, normalized], { shouldValidate: true });
    setLinkDraft("");
    setLinkError(null);
  };

  const removeLink = (url: string) =>
    setValue("attachmentUrls", links.filter((x) => x !== url), { shouldValidate: true });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">إنشاء مهمة</h1>
          <p className="meta mt-1">{TYPE_META[type].hint}</p>
        </div>
        <button onClick={() => router.back()} className="btn-ghost gap-1"><ChevronLeft className="h-4 w-4" /> رجوع</button>
      </header>

      <form onSubmit={onConfirm} className="space-y-5">
        {/* Basic */}
        <section className="card card-pad space-y-4">
          <div>
            <label className="label" htmlFor="title">عنوان المهمة</label>
            <input id="title" className="input" placeholder="مثال: إعداد تقرير الحملة الشهرية" {...register("title")} />
            {errors.title && <p className="mt-1 text-xs text-error">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="description">وصف تفصيلي</label>
            <textarea id="description" rows={4} className="input resize-none" placeholder="اشرح ما هو مطلوب بالتفصيل..." {...register("description")} />
            {errors.description && <p className="mt-1 text-xs text-error">{errors.description.message}</p>}
          </div>
        </section>

        {/* Assignment type */}
        <section className="card card-pad space-y-3">
          <p className="label">نوع الإسناد</p>
          <Controller
            control={control}
            name="assignmentType"
            render={({ field }) => (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(TYPE_META) as AssignmentType[]).map((t) => {
                  const Icon = TYPE_META[t].icon;
                  const sel = field.value === t;
                  return (
                    <button
                      key={t} type="button"
                      onClick={() => { field.onChange(t); setValue("assignedUserIds", []); setValue("assignedTeamIds", []); setValue("responsibleMemberIds", []); }}
                      className={`flex items-start gap-3 rounded-card border p-3 text-right transition ${sel ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary/40"}`}
                    >
                      <Icon className={`mt-0.5 h-5 w-5 ${sel ? "text-primary" : "text-on-surface-variant"}`} aria-hidden />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-on-surface">{assignmentAr[t]}</span>
                        <span className="meta">{TYPE_META[t].hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </section>

        {/* Assignee selection */}
        <section className="card card-pad space-y-3">
          {type === "individual" && (
            <div>
              <label className="label">العضو المسؤول</label>
              <PeopleGrid users={candidateUsers} data={data} selected={selectedUsers} onToggle={(id) => setValue("assignedUserIds", [id], { shouldValidate: true })} />
              {errors.assignedUserIds && <p className="mt-1 text-xs text-error">{errors.assignedUserIds.message as string}</p>}
            </div>
          )}

          {type === "multiple_members_shared" && (
            <div>
              <label className="label">الأعضاء (عضوان على الأقل)</label>
              <PeopleGrid users={candidateUsers} data={data} selected={selectedUsers} onToggle={(id) => toggleArray("assignedUserIds", id)} />
              {errors.assignedUserIds && <p className="mt-1 text-xs text-error">{errors.assignedUserIds.message as string}</p>}
            </div>
          )}

          {(type === "team_shared" || type === "team_member_copies") && (
            <div className="space-y-3">
              <div>
                <label className="label">الفريق المسؤول</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {candidateTeams.map((t) => {
                    const sel = selectedTeam === t.id;
                    const leaders = t.leaderIds.map((id) => userName(data, id));
                    return (
                      <button key={t.id} type="button" onClick={() => { setValue("assignedTeamIds", [t.id], { shouldValidate: true }); setValue("responsibleMemberIds", []); }}
                        className={`rounded-card border p-3 text-right transition ${sel ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary/40"}`}>
                        <p className="text-sm font-medium text-on-surface">{t.name}</p>
                        <p className="meta mt-0.5">{t.memberIds.length} أعضاء · القائد: {leaders[0] ?? "—"}</p>
                      </button>
                    );
                  })}
                </div>
                {errors.assignedTeamIds && <p className="mt-1 text-xs text-error">{errors.assignedTeamIds.message as string}</p>}
              </div>

              {selectedTeam && type === "team_shared" && (
                <div className="rounded-card bg-surface-container-low p-3">
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <Info className="h-4 w-4 text-secondary" aria-hidden />
                    يبقى <strong className="text-on-surface">{teamObj?.name}</strong> هو المسؤول الرسمي عن المهمة.
                  </div>
                  {teamObj?.leaderIds[0] && (
                    <p className="meta mt-2">قائد الفريق: {userName(data, teamObj.leaderIds[0])} <span className="align-middle"><LeaderBadge /></span></p>
                  )}
                  <label className="label mt-3">الأعضاء المسؤولون (اختياري)</label>
                  <PeopleGrid users={teamMembers} data={data} selected={responsible} onToggle={(id) => toggleArray("responsibleMemberIds", id)} compact />
                </div>
              )}

              {selectedTeam && type === "team_member_copies" && (
                <div className="rounded-card bg-surface-container-low p-3 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <Copy className="h-4 w-4 text-secondary" aria-hidden />
                    ستُنشأ <strong className="text-on-surface">{teamMembers.length}</strong> نسخة مستقلة — واحدة لكل عضو في {teamObj?.name}.
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Meta */}
        <section className="card card-pad grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="priority">الأولوية</label>
            <select id="priority" className="input" {...register("priority")}>
              {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => <option key={p} value={p}>{priorityAr[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="projectId">المشروع (اختياري)</label>
            <select id="projectId" className="input" {...register("projectId")}>
              <option value="">بدون مشروع</option>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="startDate">تاريخ البدء</label>
            <input id="startDate" type="date" dir="ltr" className="input" {...register("startDate")} />
          </div>
          <div>
            <label className="label" htmlFor="dueDate">تاريخ الاستحقاق</label>
            <input id="dueDate" type="date" dir="ltr" className="input" {...register("dueDate")} />
            {errors.dueDate && <p className="mt-1 text-xs text-error">{errors.dueDate.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="category">التصنيف (اختياري)</label>
            <input id="category" className="input" placeholder="مثال: محتوى" {...register("category")} />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input type="checkbox" className="h-4 w-4 accent-primary" {...register("approvalRequired")} /> تتطلب موافقة قبل الإكمال
            </label>
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input type="checkbox" className="h-4 w-4 accent-primary" {...register("proofRequired")} /> تتطلب إثبات إنجاز
            </label>
          </div>
        </section>

        {/* Attachments / links */}
        <section className="card card-pad space-y-3">
          <div>
            <label className="label flex items-center gap-1.5" htmlFor="linkDraft">
              <Link2 className="h-4 w-4 text-on-surface-variant" aria-hidden /> روابط ومرفقات (اختياري)
            </label>
            <p className="meta">أضف رابط ملف أو مجلد (Google Drive، Dropbox، رابط مستند…). يُفتح في تبويب جديد.</p>
            <div className="mt-2 flex gap-2">
              <input
                id="linkDraft" type="url" dir="ltr" className="input flex-1"
                placeholder="https://drive.google.com/..."
                value={linkDraft}
                onChange={(e) => { setLinkDraft(e.target.value); setLinkError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
              />
              <button type="button" onClick={addLink} className="btn-outline gap-1 px-3">
                <Plus className="h-4 w-4" /> إضافة
              </button>
            </div>
            {linkError && <p className="mt-1 text-xs text-error">{linkError}</p>}
          </div>
          {links.length > 0 && (
            <ul className="space-y-1.5">
              {links.map((url) => (
                <li key={url} className="flex items-center gap-2 rounded-card border border-outline-variant bg-surface-container-low p-2">
                  <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <a href={url} target="_blank" rel="noopener noreferrer" dir="ltr" className="min-w-0 flex-1 truncate text-sm text-primary hover:underline">{url}</a>
                  <button type="button" onClick={() => removeLink(url)} className="btn-ghost p-1 text-on-surface-variant hover:text-error" aria-label="إزالة الرابط">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary">معاينة وحفظ</button>
          <button type="button" onClick={() => router.back()} className="btn-ghost">إلغاء</button>
        </div>
      </form>

      {confirming && (
        <ConfirmDialog
          values={previewValues ?? watch()}
          data={data}
          onClose={() => { setConfirming(false); setPreviewValues(null); }}
          onSave={() => finalize(false)}
          onSaveAnother={() => finalize(true)}
        />
      )}
    </div>
  );
}

function PeopleGrid({
  users, data, selected, onToggle, compact,
}: {
  users: { id: string; name: string }[];
  data: WorkspaceData;
  selected: string[];
  onToggle: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
      {users.map((u) => {
        const sel = selected.includes(u.id);
        const isLeader = data.teams.some((t) => t.leaderIds.includes(u.id));
        return (
          <button key={u.id} type="button" onClick={() => onToggle(u.id)}
            className={`flex items-center gap-2 rounded-card border p-2 text-right transition ${sel ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary/40"}`}>
            <Avatar name={u.name} size={28} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-sm text-on-surface">{u.name}</span>
                {isLeader && <LeaderBadge />}
              </span>
            </span>
            {sel && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

function ConfirmDialog({
  values, data, onClose, onSave, onSaveAnother,
}: {
  values: TaskInput; data: WorkspaceData; onClose: () => void; onSave: () => void; onSaveAnother: () => void;
}) {
  const team = values.assignedTeamIds[0] ? getTeam(data, values.assignedTeamIds[0]) : undefined;
  const leaderName = team?.leaderIds[0] ? userName(data, team.leaderIds[0]) : undefined;
  const recipients =
    values.assignmentType === "individual" || values.assignmentType === "multiple_members_shared"
      ? values.assignedUserIds.map((id) => userName(data, id))
      : values.assignmentType === "team_member_copies"
      ? membersOfTeam(data, values.assignedTeamIds[0]).map((m) => m.name)
      : [team?.name, leaderName, ...values.responsibleMemberIds.map((id) => userName(data, id))].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-on-surface">تأكيد إنشاء المهمة</h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <Row k="نوع الإسناد" v={assignmentAr[values.assignmentType]} />
          {team && <Row k="الفريق المسؤول" v={team.name} />}
          {leaderName && values.assignmentType === "team_shared" && <Row k="قائد الفريق" v={leaderName} />}
          <Row k="الأولوية" v={priorityAr[values.priority]} />
          <Row k="تاريخ الاستحقاق" v={values.dueDate || "—"} ltr />
          {values.attachmentUrls.length > 0 && <Row k="روابط مرفقة" v={`${values.attachmentUrls.length}`} />}
          <Row k="مستلمو الإشعارات" v={recipients.join("، ") || "—"} />
        </dl>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={onSave} className="btn-primary">حفظ المهمة</button>
          <button onClick={onSaveAnother} className="btn-outline">حفظ وإضافة أخرى</button>
          <button onClick={onClose} className="btn-ghost">تعديل</button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, ltr }: { k: string; v: string; ltr?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-outline-variant/40 pb-2">
      <dt className="text-on-surface-variant">{k}</dt>
      <dd className={`font-medium text-on-surface ${ltr ? "font-mono" : ""}`} dir={ltr ? "ltr" : undefined}>{v}</dd>
    </div>
  );
}
