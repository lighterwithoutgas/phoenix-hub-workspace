"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Play, Send, CheckCircle2, AlertTriangle, Trash2, Pencil, Plus,
  MessageSquare, History, ShieldAlert, CalendarClock, ListChecks, Flag, Lock, Link2, X,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  canSeeTask, canWorkOnTask, canReviewTask, canDeleteTask, canEditTaskAdminFields, isElevated,
} from "@/lib/permissions";
import { getTeam, getUser, userName } from "@/lib/selectors";
import {
  StatusBadge, PriorityBadge, LeaderBadge, Avatar, ProgressBar, SectionTitle, EmptyState, ConfirmDialog,
} from "@/components/ui";
import {
  assignmentAr, fmtDate, fmtDateTime, fmtRelative, priorityAr,
} from "@/lib/arabic";
import type { Blocker, Task, TaskPriority, WorkspaceData } from "@/lib/types";
import type { TaskEditPatch } from "@/lib/workspace-context";

export default function TaskDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    currentUser, data, updateTask, updateTaskStatus, updateProgress, toggleChecklist,
    addComment, reportBlocker, submitForReview, reviewTask, requestExtension,
    reviewExtension, deleteTask, deleteComment,
  } = useWorkspace();

  const task = data.tasks.find((t) => t.id === id);
  const [comment, setComment] = useState("");
  const [showBlocker, setShowBlocker] = useState(false);
  const [showExt, setShowExt] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [rejectingExtensionId, setRejectingExtensionId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [localProgress, setLocalProgress] = useState(task?.progress ?? 0);

  useEffect(() => {
    setLocalProgress(task?.progress ?? 0);
  }, [task?.id, task?.progress]);

  const commitProgress = () => {
    if (!task || localProgress === task.progress) return;
    updateProgress(task.id, localProgress);
  };

  if (!currentUser) return null;
  if (!task) {
    return (
      <div className="card card-pad text-center">
        <EmptyState title="المهمة غير موجودة" hint="ربما حُذفت أو لا تملك صلاحية الوصول." icon={AlertTriangle} />
        <button onClick={() => router.push("/tasks")} className="btn-outline mx-auto mt-3">العودة للمهام</button>
      </div>
    );
  }
  if (!canSeeTask(currentUser, task, data.users)) {
    return (
      <div className="card card-pad text-center">
        <EmptyState title="غير مصرح بالدخول" hint="لا تملك صلاحية عرض هذه المهمة." icon={Lock} />
      </div>
    );
  }

  const canWork = canWorkOnTask(currentUser, task, data.users);
  const canReview = canReviewTask(currentUser, task, data.users);
  const canEdit = isElevated(currentUser) || task.createdBy === currentUser.id || canEditTaskAdminFields(currentUser, task);
  const elevatedAutoApprove = task.approvalRequired && isElevated(currentUser);
  const isTeam = task.assignmentType === "team_shared";
  const team = task.assignedTeamIds[0] ? getTeam(data, task.assignedTeamIds[0]) : undefined;
  const comments = data.comments.filter((c) => c.taskId === task.id);
  const activities = data.activities.filter((a) => a.taskId === task.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const extensions = data.extensions.filter((e) => e.taskId === task.id);
  const checklistDone = task.checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <button onClick={() => router.back()} className="btn-ghost gap-1"><ChevronLeft className="h-4 w-4" /> رجوع</button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-on-surface-variant" dir="ltr">{task.taskNumber}</span>
          {canEdit && (
            <button onClick={() => setShowEdit(true)} className="btn-ghost gap-1 px-2 text-primary hover:bg-primary/10" aria-label="تعديل المهمة">
              <Pencil className="h-4 w-4" /> تعديل
            </button>
          )}
          {canDeleteTask(currentUser, task, data.users) && (
            <button onClick={() => setConfirmDelete(true)} className="btn-ghost gap-1 px-2 text-error hover:bg-error/10" aria-label="حذف المهمة">
              <Trash2 className="h-4 w-4" /> حذف
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-5 lg:col-span-2">
          <div className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                {isTeam && <span className="badge mb-2 inline-flex bg-primary/10 text-primary">مهمة فريق</span>}
                <h1 className="text-xl font-bold text-on-surface">{task.title}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">{task.description}</p>

            {/* Progress */}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="label mb-0">التقدم</span>
                <span className="font-mono text-sm text-on-surface">{localProgress}٪</span>
              </div>
              <ProgressBar value={localProgress} />
              {canWork && (
                <input
                  type="range" min={0} max={100} step={5} value={localProgress}
                  onChange={(e) => setLocalProgress(Number(e.target.value))}
                  onBlur={commitProgress}
                  onPointerUp={commitProgress}
                  onKeyUp={commitProgress}
                  className="mt-2 w-full accent-secondary"
                  aria-label="تحديث التقدم"
                />
              )}
            </div>
          </div>

          {/* Blocker banner */}
          {task.status === "blocked" && task.blocker && (
            <div className="card card-pad border-coral/40 bg-coral/5">
              <div className="flex items-center gap-2 text-coral"><ShieldAlert className="h-4 w-4" /> <span className="font-medium">المهمة متوقفة</span></div>
              <dl className="mt-2 space-y-1 text-sm text-on-surface-variant">
                <div><span className="text-on-surface">نوع العائق:</span> {task.blocker.type}</div>
                <div><span className="text-on-surface">الشرح:</span> {task.blocker.description}</div>
                <div><span className="text-on-surface">المساعدة المطلوبة:</span> {task.blocker.helpNeeded}</div>
                <div><span className="text-on-surface">من:</span> {task.blocker.blockedBy}</div>
              </dl>
            </div>
          )}

          {/* Review result */}
          {task.review && (
            <div className={`card card-pad ${task.review.decision === "approved" ? "border-secondary/40 bg-secondary/5" : "border-amber/40 bg-amber/5"}`}>
              <div className="flex items-center gap-2 font-medium text-on-surface">
                {task.review.decision === "approved" ? <CheckCircle2 className="h-4 w-4 text-secondary" /> : <AlertTriangle className="h-4 w-4 text-amber" />}
                {task.review.decision === "approved" ? "تمت الموافقة" : task.review.decision === "rejected" ? "مرفوضة" : "مطلوب تعديلات"}
              </div>
              <p className="meta mt-1">بواسطة {userName(data, task.review.reviewerId)} · {fmtRelative(task.review.createdAt)}</p>
              {task.review.note && <p className="mt-2 text-sm text-on-surface-variant">{task.review.note}</p>}
            </div>
          )}

          {/* Checklist */}
          {task.checklist.length > 0 && (
            <div className="card card-pad">
              <SectionTitle><span className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> قائمة التحقق ({checklistDone}/{task.checklist.length})</span></SectionTitle>
              <ul className="mt-2 space-y-1">
                {task.checklist.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low">
                      <input type="checkbox" checked={item.done} disabled={!canWork} onChange={() => toggleChecklist(task.id, item.id)} className="h-4 w-4 accent-secondary" />
                      <span className={`text-sm ${item.done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{item.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Attachments / links */}
          {task.attachmentUrls.length > 0 && (
            <div className="card card-pad">
              <SectionTitle><span className="flex items-center gap-2"><Link2 className="h-4 w-4" /> روابط ومرفقات ({task.attachmentUrls.length})</span></SectionTitle>
              <ul className="mt-2 space-y-1.5">
                {task.attachmentUrls.map((url) => (
                  <li key={url} className="flex items-center gap-2 rounded-card border border-outline-variant bg-surface-container-low p-2">
                    <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <a href={url} target="_blank" rel="noopener noreferrer" dir="ltr" className="min-w-0 flex-1 truncate text-sm text-primary hover:underline">{url}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comments */}
          <div className="card card-pad">
            <SectionTitle><span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> التعليقات</span></SectionTitle>
            <div className="mt-2 space-y-3">
              {comments.length ? comments.map((c) => {
                const author = getUser(data, c.userId);
                const isLeader = data.teams.some((t) => t.leaderIds.includes(c.userId));
                return (
                  <div key={c.id} className="group flex gap-2">
                    <Avatar name={author?.name ?? "?"} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-on-surface">{author?.name}</span>
                        {isLeader && <LeaderBadge />}
                        <span className="meta">· {fmtRelative(c.createdAt)}</span>
                        {(c.userId === currentUser.id || isElevated(currentUser)) && (
                          <button onClick={() => deleteComment(c.id)} className="ms-auto text-on-surface-variant opacity-0 transition hover:text-error group-hover:opacity-100" aria-label="حذف التعليق">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-on-surface-variant">{c.body}</p>
                    </div>
                  </div>
                );
              }) : <p className="meta">لا توجد تعليقات بعد.</p>}
            </div>
            {currentUser.role !== "viewer" && (
              <div className="mt-3 flex gap-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} className="input flex-1" placeholder="أضف تعليقاً..." />
                <button onClick={() => { if (comment.trim()) { addComment(task.id, comment.trim(), []); setComment(""); } }} className="btn-primary px-3" aria-label="إرسال"><Send className="h-4 w-4" /></button>
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="card card-pad">
            <SectionTitle><span className="flex items-center gap-2"><History className="h-4 w-4" /> سجل النشاط</span></SectionTitle>
            <ol className="mt-2 space-y-2">
              {activities.length ? activities.slice(0, 25).map((a) => (
                <li key={a.id} className="flex gap-2 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-outline-variant" aria-hidden />
                  <div>
                    <span className="text-on-surface">{userName(data, a.userId)}</span>{" "}
                    <span className="text-on-surface-variant">{a.action}</span>
                    <span className="meta block">{fmtDateTime(a.createdAt)}</span>
                  </div>
                </li>
              )) : <p className="meta">لا يوجد نشاط مسجل.</p>}
              {activities.length > 25 && <p className="meta">+ {activities.length - 25} نشاط أقدم</p>}
            </ol>
          </div>
        </div>

        {/* Side panel */}
        <aside className="space-y-4">
          <div className="card card-pad space-y-3 text-sm">
            <SectionTitle>تفاصيل المهمة</SectionTitle>
            <Detail k="نوع الإسناد" v={assignmentAr[task.assignmentType]} />
            {isTeam && team ? (
              <>
                <Detail k="الفريق المسؤول" v={team.name} />
                {team.leaderIds[0] && <div className="flex items-center justify-between"><span className="text-on-surface-variant">قائد الفريق</span><span className="flex items-center gap-1.5 font-medium text-on-surface">{userName(data, team.leaderIds[0])} <LeaderBadge /></span></div>}
                {task.responsibleMemberIds.length > 0 && <Detail k="الأعضاء المسؤولون" v={task.responsibleMemberIds.map((mid) => userName(data, mid)).join("، ")} />}
              </>
            ) : (
              <Detail k="المسؤول" v={task.assignedUserIds.map((uid) => userName(data, uid)).join("، ") || "—"} />
            )}
            {task.projectId && <Detail k="المشروع" v={data.projects.find((p) => p.id === task.projectId)?.name ?? "—"} />}
            <Detail k="أنشأها" v={userName(data, task.createdBy)} />
            {task.startDate && <Detail k="تاريخ البدء" v={fmtDate(task.startDate)} />}
            <Detail k="تاريخ الاستحقاق" v={fmtDate(task.dueDate)} tone={task.status === "overdue" ? "error" : undefined} />
            <Detail k="تتطلب موافقة" v={task.approvalRequired ? "نعم" : "لا"} />
            {task.proofUrl && (
              <div className="flex justify-between gap-3">
                <span className="text-on-surface-variant">إثبات الإنجاز</span>
                <a href={task.proofUrl} target="_blank" rel="noopener noreferrer" dir="ltr" className="flex min-w-0 items-center gap-1 truncate text-end font-medium text-primary hover:underline">
                  <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden /> عرض الرابط
                </a>
              </div>
            )}
            <Detail k="آخر تحديث" v={fmtRelative(task.updatedAt)} />
          </div>

          {/* Actions */}
          {canWork && task.status !== "completed" && task.status !== "cancelled" && (
            <div className="card card-pad space-y-2">
              <SectionTitle>الإجراءات</SectionTitle>
              {task.status === "scheduled" && (
                <button onClick={() => updateTaskStatus(task.id, "in_progress")} className="btn-primary w-full gap-2"><Play className="h-4 w-4" /> بدء المهمة</button>
              )}
              {(task.status === "in_progress" || task.status === "blocked") && (
                <>
                  {task.status !== "blocked" && (
                    <button onClick={() => setShowBlocker(true)} className="btn-outline w-full gap-2"><ShieldAlert className="h-4 w-4" /> الإبلاغ عن عائق</button>
                  )}
                  {task.status === "blocked" && (
                    <button onClick={() => updateTaskStatus(task.id, "in_progress")} className="btn-outline w-full gap-2"><Play className="h-4 w-4" /> استئناف العمل</button>
                  )}
                  <button onClick={() => setShowExt(true)} className="btn-outline w-full gap-2"><CalendarClock className="h-4 w-4" /> طلب تمديد الموعد</button>
                  {task.approvalRequired ? (
                    <button onClick={() => setShowComplete(true)} className="btn-primary w-full gap-2">
                      {elevatedAutoApprove ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      {elevatedAutoApprove ? "اعتماد المهمة" : "إرسال للمراجعة"}
                    </button>
                  ) : (
                    <button onClick={() => setShowComplete(true)} className="btn-primary w-full gap-2"><CheckCircle2 className="h-4 w-4" /> تحديد كمكتملة</button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Review controls */}
          {canReview && task.status === "awaiting_review" && (
            <div className="card card-pad space-y-2 border-amber/40">
              <SectionTitle>المراجعة والاعتماد</SectionTitle>
              <p className="meta">هذه المهمة بانتظار قرارك.</p>
              <button onClick={() => setShowReview(true)} className="btn-primary w-full gap-2"><CheckCircle2 className="h-4 w-4" /> مراجعة المهمة</button>
            </div>
          )}

          {/* Extensions */}
          {extensions.length > 0 && (
            <div className="card card-pad space-y-2">
              <SectionTitle>طلبات التمديد</SectionTitle>
              {extensions.map((e) => (
                <div key={e.id} className="rounded-lg bg-surface-container-low p-2 text-sm">
                  <p className="text-on-surface">الموعد المطلوب: <span className="font-mono" dir="ltr">{fmtDate(e.requestedDueDate)}</span></p>
                  <p className="meta">{e.reason} · {e.status === "pending" ? "بانتظار المراجعة" : e.status === "approved" ? "تمت الموافقة" : "مرفوض"}</p>
                  {e.notes && <p className="meta mt-1">{e.notes}</p>}
                  {e.reviewNote && <p className="mt-1 text-xs text-on-surface-variant">ملاحظة القرار: {e.reviewNote}</p>}
                  {canReview && e.status === "pending" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => reviewExtension(e.id, "approved", "")} className="btn-primary gap-2 px-3 py-1.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> قبول
                      </button>
                      <button onClick={() => setRejectingExtensionId(e.id)} className="btn-danger gap-2 px-3 py-1.5 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" /> رفض
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {showBlocker && <BlockerDialog onClose={() => setShowBlocker(false)} onSubmit={(b) => { reportBlocker(task.id, b); setShowBlocker(false); }} />}
      {showExt && <ExtensionDialog onClose={() => setShowExt(false)} onSubmit={(d, r, n) => { requestExtension(task.id, { requestedDueDate: d, reason: r, notes: n }); setShowExt(false); }} />}
      {showReview && <ReviewDialog onClose={() => setShowReview(false)} onSubmit={(decision, note) => { reviewTask(task.id, decision, note); setShowReview(false); }} />}
      {rejectingExtensionId && (
        <ExtensionRejectDialog
          onClose={() => setRejectingExtensionId(null)}
          onSubmit={(note) => {
            reviewExtension(rejectingExtensionId, "rejected", note);
            setRejectingExtensionId(null);
          }}
        />
      )}
      {showComplete && (
        <CompleteDialog
          mode={task.approvalRequired && !elevatedAutoApprove ? "review" : "complete"}
          proofRequired={task.proofRequired}
          onClose={() => setShowComplete(false)}
          onSubmit={(submittedLinks) => {
            const merged = Array.from(new Set([...task.attachmentUrls, ...submittedLinks]));
            const extra = { proofUrl: submittedLinks[0] ?? task.proofUrl, attachmentUrls: merged };
            if (task.approvalRequired) submitForReview(task.id, extra);
            else updateTaskStatus(task.id, "completed", extra);
            setShowComplete(false);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="حذف المهمة"
        message={`سيتم حذف "${task.title}" وكل ما يتعلق بها (التعليقات، السجل، الطلبات). لا يمكن التراجع.`}
        confirmLabel="نعم، احذف"
        onConfirm={() => { deleteTask(task.id); router.push("/tasks"); }}
        onCancel={() => setConfirmDelete(false)}
      />

      {showEdit && (
        <TaskEditDialog
          task={task}
          data={data}
          onClose={() => setShowEdit(false)}
          onSave={(patch) => { updateTask(task.id, patch); setShowEdit(false); }}
        />
      )}
    </div>
  );
}

function TaskEditDialog({
  task, data, onClose, onSave,
}: {
  task: Task;
  data: WorkspaceData;
  onClose: () => void;
  onSave: (patch: TaskEditPatch) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [startDate, setStart] = useState(task.startDate ? task.startDate.slice(0, 10) : "");
  const [dueDate, setDue] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [category, setCategory] = useState(task.category ?? "");
  const [projectId, setProjectId] = useState(task.projectId ?? "");
  const [approvalRequired, setApproval] = useState(task.approvalRequired);
  const [proofRequired, setProof] = useState(task.proofRequired);
  const [links, setLinks] = useState<string[]>(task.attachmentUrls);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const valid = title.trim().length >= 3 && description.trim().length >= 1 && !!dueDate;

  const addLink = () => {
    const raw = linkDraft.trim();
    if (!raw) return;
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      // eslint-disable-next-line no-new
      new URL(normalized);
    } catch {
      setLinkError("رابط غير صالح");
      return;
    }
    if (!links.includes(normalized)) setLinks([...links, normalized]);
    setLinkDraft("");
    setLinkError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-on-surface">تعديل المهمة</h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <label className="label">عنوان المهمة</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">الوصف</label>
            <textarea rows={4} className="input resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">الأولوية</label>
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => <option key={p} value={p}>{priorityAr[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">المشروع</label>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">بدون مشروع</option>
                {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">تاريخ البدء</label>
              <input type="date" dir="ltr" className="input" value={startDate} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label">تاريخ الاستحقاق</label>
              <input type="date" dir="ltr" className="input" value={dueDate} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">التصنيف</label>
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="مثال: محتوى" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={approvalRequired} onChange={(e) => setApproval(e.target.checked)} /> تتطلب موافقة قبل الإكمال
            </label>
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={proofRequired} onChange={(e) => setProof(e.target.checked)} /> تتطلب إثبات إنجاز
            </label>
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Link2 className="h-4 w-4" /> روابط ومرفقات</label>
            <div className="mt-1 flex gap-2">
              <input
                type="url" dir="ltr" className="input flex-1" placeholder="https://drive.google.com/..."
                value={linkDraft}
                onChange={(e) => { setLinkDraft(e.target.value); setLinkError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
              />
              <button type="button" onClick={addLink} className="btn-outline gap-1 px-3"><Plus className="h-4 w-4" /> إضافة</button>
            </div>
            {linkError && <p className="mt-1 text-xs text-error">{linkError}</p>}
            {links.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {links.map((url) => (
                  <li key={url} className="flex items-center gap-2 rounded-card border border-outline-variant bg-surface-container-low p-2">
                    <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <a href={url} target="_blank" rel="noopener noreferrer" dir="ltr" className="min-w-0 flex-1 truncate text-sm text-primary hover:underline">{url}</a>
                    <button type="button" onClick={() => setLinks(links.filter((x) => x !== url))} className="btn-ghost p-1 text-on-surface-variant hover:text-error" aria-label="إزالة الرابط"><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              disabled={!valid}
              onClick={() => onSave({ title, description, priority, startDate, dueDate, category, projectId, approvalRequired, proofRequired, attachmentUrls: links })}
              className="btn-primary disabled:opacity-50"
            >
              حفظ
            </button>
            <button onClick={onClose} className="btn-ghost">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ k, v, tone }: { k: string; v: string; tone?: "error" }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-on-surface-variant">{k}</span>
      <span className={`text-end font-medium ${tone === "error" ? "text-error" : "text-on-surface"}`}>{v}</span>
    </div>
  );
}

/* ---- dialogs ---- */

function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <h3 className="text-lg font-bold text-on-surface">{title}</h3>
        <div className="mt-3 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function BlockerDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (b: Blocker) => void }) {
  const [b, setB] = useState<Blocker>({ type: "", description: "", helpNeeded: "", blockedBy: "" });
  const valid = b.type && b.description && b.helpNeeded && b.blockedBy;
  return (
    <Modal title="الإبلاغ عن عائق">
      <div><label className="label">نوع العائق</label><input className="input" value={b.type} onChange={(e) => setB({ ...b, type: e.target.value })} /></div>
      <div><label className="label">شرح العائق</label><textarea rows={2} className="input resize-none" value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} /></div>
      <div><label className="label">المساعدة المطلوبة</label><input className="input" value={b.helpNeeded} onChange={(e) => setB({ ...b, helpNeeded: e.target.value })} /></div>
      <div><label className="label">الشخص أو الفريق المطلوب</label><input className="input" value={b.blockedBy} onChange={(e) => setB({ ...b, blockedBy: e.target.value })} /></div>
      <div className="flex justify-end gap-2 pt-1">
        <button disabled={!valid} onClick={() => onSubmit(b)} className="btn-danger disabled:opacity-50">تسجيل العائق</button>
        <button onClick={onClose} className="btn-ghost">إلغاء</button>
      </div>
    </Modal>
  );
}

function ExtensionDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (date: string, reason: string, notes?: string) => void }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Modal title="طلب تمديد الموعد">
      <div><label className="label">الموعد الجديد المطلوب</label><input type="date" dir="ltr" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><label className="label">سبب الطلب</label><textarea rows={2} className="input resize-none" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <div><label className="label">ملاحظات إضافية (اختياري)</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="flex justify-end gap-2 pt-1">
        <button disabled={!date || !reason} onClick={() => onSubmit(date, reason, notes)} className="btn-primary disabled:opacity-50">إرسال الطلب</button>
        <button onClick={onClose} className="btn-ghost">إلغاء</button>
      </div>
    </Modal>
  );
}

function ExtensionRejectDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Modal title="رفض طلب التمديد">
      <div>
        <label className="label">سبب الرفض (اختياري)</label>
        <textarea
          rows={3}
          className="input resize-none"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="اكتب السبب إذا احتجت توضيح القرار..."
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => onSubmit(note.trim())} className="btn-danger gap-2">
          <AlertTriangle className="h-4 w-4" /> رفض الطلب
        </button>
        <button onClick={onClose} className="btn-ghost">إلغاء</button>
      </div>
    </Modal>
  );
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(normalized);
    return normalized;
  } catch {
    return null;
  }
}

function CompleteDialog({
  mode, onClose, onSubmit,
}: {
  mode: "complete" | "review";
  proofRequired: boolean;
  onClose: () => void;
  onSubmit: (links: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const invalidUrlMessage = "رابط غير صالح";

  const add = () => {
    const url = normalizeUrl(draft);
    if (!url) { setErr(invalidUrlMessage); return; }
    if (links.includes(url)) { setErr("الرابط مضاف مسبقاً"); return; }
    setLinks([...links, url]);
    setDraft("");
    setErr(null);
  };
  const remove = (u: string) => setLinks(links.filter((x) => x !== u));

  const submit = () => {
    const trimmed = draft.trim();
    let finalLinks = links;
    if (trimmed) {
      const url = normalizeUrl(trimmed);
      if (!url) { setErr(invalidUrlMessage); return; }
      if (!finalLinks.includes(url)) finalLinks = [...finalLinks, url];
    }
    onSubmit(finalLinks);
  };

  const canSubmit = true;
  const submitLabel = mode === "review" ? "إرسال للمراجعة" : "تحديد كمكتملة";

  return (
    <Modal title={mode === "review" ? "إرسال المهمة للمراجعة" : "تأكيد إكمال المهمة"}>
      <div>
        <label className="label flex items-center gap-1.5">
          <Link2 className="h-4 w-4 text-on-surface-variant" aria-hidden />
          رابط التسليم (اختياري)
        </label>
        <p className="meta">
          يمكنك إضافة رابط ملف أو مجلد إذا احتجت، أو إرسال المهمة للمراجعة بدون رابط.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="url" dir="ltr" className="input flex-1"
            placeholder="https://drive.google.com/..."
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
          <button type="button" onClick={add} className="btn-outline px-3">إضافة</button>
        </div>
        {err && <p className="mt-1 text-xs text-error">{err}</p>}
      </div>
      {links.length > 0 && (
        <ul className="space-y-1.5">
          {links.map((url) => (
            <li key={url} className="flex items-center gap-2 rounded-card border border-outline-variant bg-surface-container-low p-2">
              <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span dir="ltr" className="min-w-0 flex-1 truncate text-sm text-on-surface">{url}</span>
              <button type="button" onClick={() => remove(url)} className="btn-ghost p-1 text-on-surface-variant hover:text-error" aria-label="إزالة الرابط">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button disabled={!canSubmit} onClick={submit} className="btn-primary gap-2 disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4" /> {submitLabel}
        </button>
        <button onClick={onClose} className="btn-ghost">إلغاء</button>
      </div>
    </Modal>
  );
}

function ReviewDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: "approved" | "rejected" | "changes_requested", note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Modal title="مراجعة المهمة">
      <div><label className="label">ملاحظة المراجعة (اختياري)</label><textarea rows={3} className="input resize-none" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div className="grid grid-cols-1 gap-2 pt-1">
        <button onClick={() => onSubmit("approved", note)} className="btn-primary gap-2"><CheckCircle2 className="h-4 w-4" /> موافقة</button>
        <button onClick={() => onSubmit("changes_requested", note)} className="btn-outline gap-2"><Flag className="h-4 w-4" /> طلب تعديلات</button>
        <button onClick={() => onSubmit("rejected", note)} className="btn-danger gap-2"><AlertTriangle className="h-4 w-4" /> رفض</button>
        <button onClick={onClose} className="btn-ghost">إلغاء</button>
      </div>
    </Modal>
  );
}
