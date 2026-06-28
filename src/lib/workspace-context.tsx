"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type {
  WorkspaceData, User, Task, TaskStatus, TaskPriority, Notification, Invitation,
  Blocker, ExtensionRequest, Team, Project, ProjectStatus, Announcement,
} from "./types";
import type {
  TaskInput, InviteInput, ExtensionInput,
  TeamInput, ProjectInput, AnnouncementInput, UserProfileInput,
} from "./schemas";
import { loadSession, saveSession } from "./session";
import { apiLoadWorkspace, apiLogin, apiPersistWorkspace, apiSendInvitationEmail, apiSendNotificationEmails } from "./api/workspace";
import { uid, nowIso, daysFromNow } from "./utils";
import {
  can, canDeleteTask, canEditTaskAdminFields, canManageAnnouncement, canReviewTask, canSeeAnnouncement, canSeeTask, canWorkOnTask, isElevated,
} from "./permissions";

export type TaskEditPatch = {
  title?: string; description?: string; priority?: TaskPriority;
  startDate?: string; dueDate?: string; category?: string; projectId?: string;
  approvalRequired?: boolean; proofRequired?: boolean; attachmentUrls?: string[];
};
export type AnnouncementEditPatch = {
  title?: string; body?: string; priority?: TaskPriority;
  audienceType?: "all" | "teams"; audienceIds?: string[]; requireAck?: boolean;
};
export type ProjectEditPatch = {
  name?: string; description?: string; teamIds?: string[]; managerId?: string;
  startDate?: string; endDate?: string; priority?: TaskPriority; status?: ProjectStatus;
};

interface Ctx {
  ready: boolean;
  currentUser: User | null;
  data: WorkspaceData;
  login: (email: string, password?: string) => Promise<User | null>;
  logout: () => void;
  // actions
  createTask: (input: TaskInput) => Task[] | null;
  acceptTask: (taskId: string) => void;
  updateTask: (taskId: string, patch: TaskEditPatch) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus, extra?: Partial<Task>) => void;
  updateProgress: (taskId: string, progress: number) => void;
  toggleChecklist: (taskId: string, itemId: string) => void;
  addComment: (taskId: string, body: string, mentions: string[]) => void;
  reportBlocker: (taskId: string, blocker: Blocker) => void;
  submitForReview: (taskId: string, extra?: Partial<Task>) => void;
  reviewTask: (taskId: string, decision: "approved" | "rejected" | "changes_requested", note: string) => void;
  requestExtension: (taskId: string, input: ExtensionInput) => void;
  reviewExtension: (extId: string, decision: "approved" | "rejected", note: string) => void;
  inviteMember: (input: InviteInput) => Invitation | null;
  resendInvitation: (invId: string) => void;
  cancelInvitation: (invId: string) => void;
  updateMemberRole: (userId: string, role: User["role"]) => void;
  updateMyProfile: (profile: UserProfileInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  // create
  createTeam: (input: TeamInput) => Team | null;
  updateTeam: (teamId: string, input: { name: string; description?: string }) => void;
  addTeamMembers: (teamId: string, userIds: string[], asLeader?: boolean) => void;
  removeTeamMember: (teamId: string, userId: string) => void;
  setTeamLeadership: (teamId: string, userId: string, makeLeader: boolean) => void;
  createProject: (input: ProjectInput) => Project | null;
  updateProject: (id: string, patch: ProjectEditPatch) => void;
  createAnnouncement: (input: AnnouncementInput) => Announcement | null;
  updateAnnouncement: (id: string, patch: AnnouncementEditPatch) => void;
  acknowledgeAnnouncement: (id: string) => void;
  // delete / destructive
  deleteTask: (taskId: string) => void;
  deleteTeam: (teamId: string) => void;
  deleteProject: (projectId: string) => void;
  deleteAnnouncement: (id: string) => void;
  deleteComment: (commentId: string) => void;
  setMemberStatus: (userId: string, status: "active" | "suspended") => void;
  removeMember: (userId: string) => void;
}

const WorkspaceContext = createContext<Ctx | null>(null);

const EMPTY_WORKSPACE: WorkspaceData = {
  users: [], teams: [], tasks: [], projects: [], announcements: [],
  invitations: [], activities: [], comments: [], notifications: [], extensions: [],
};

// One-time migration: older data baked "overdue" into the stored status, which
// destroyed the real workflow state. Delay is now derived (see isDelayed), so heal
// any legacy "overdue" task back to in_progress on load.
const healLegacyOverdue = (d: WorkspaceData): WorkspaceData => ({
  ...d,
  tasks: d.tasks.map((t) =>
    (t.status as string) === "overdue"
      ? { ...t, status: "in_progress" as TaskStatus }
      : t
  ),
});

function invitationToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "");
  }
  return `${uid("tok")}${uid("")}`;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<WorkspaceData>(() =>
    typeof window === "undefined" ? ({} as WorkspaceData) : EMPTY_WORKSPACE
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistRef = useRef<{ data: WorkspaceData; actorId: string } | null>(null);

  const schedulePersist = useCallback((next: WorkspaceData, actorId: string) => {
    pendingPersistRef.current = { data: next, actorId };
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const pending = pendingPersistRef.current;
      pendingPersistRef.current = null;
      persistTimerRef.current = null;
      if (!pending) return;
      void apiPersistWorkspace(pending.data, pending.actorId).catch((error) => {
        console.error("Failed to persist Mongo workspace", error);
      });
    }, 450);
  }, []);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      const pending = pendingPersistRef.current;
      pendingPersistRef.current = null;
      persistTimerRef.current = null;
      if (pending) {
        void apiPersistWorkspace(pending.data, pending.actorId).catch((error) => {
          console.error("Failed to persist Mongo workspace", error);
        });
      }
    };
  }, []);

  // hydrate on client from Mongo API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      try {
        const d = healLegacyOverdue(await apiLoadWorkspace());
        if (cancelled) return;
        setData(d);
        const sid = loadSession();
        if (sid) setCurrentUser(d.users.find((u) => u.id === sid && u.accountStatus !== "suspended") ?? null);
      } catch (error) {
        console.error("Failed to hydrate Mongo workspace", error);
        if (!cancelled) setData(EMPTY_WORKSPACE);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const commit = useCallback((next: WorkspaceData) => {
    setData(() => {
      const actorId = currentUser?.id;
      if (actorId) {
        schedulePersist(next, actorId);
      }
      return next;
    });
  }, [currentUser, schedulePersist]);

  const log = useCallback(
    (next: WorkspaceData, taskId: string, action: string, prev?: unknown, val?: unknown): WorkspaceData => {
      next.activities = [
        { id: uid("act"), taskId, userId: currentUser?.id ?? "system", action, previousValue: prev, newValue: val, createdAt: nowIso() },
        ...next.activities,
      ];
      return next;
    },
    [currentUser]
  );

  const notify = useCallback((next: WorkspaceData, recipients: string[], type: string, title: string, message: string, taskId?: string) => {
    const fresh: Notification[] = recipients.map((rid) => ({
      id: uid("ntf"), recipientId: rid, taskId, type, title, message,
      deliveryMethods: ["in_app", "push", "email"], read: false, deliveryStatus: "delivered", createdAt: nowIso(),
    }));
    next.notifications = [...fresh, ...next.notifications];
    const actorId = currentUser?.id;
    if (actorId && fresh.length) {
      void apiSendNotificationEmails(fresh, actorId).catch((error) => {
        console.error("Failed to send notification emails", error);
      });
    }
    return next;
  }, [currentUser]);

  const login = useCallback(async (mail: string, password?: string): Promise<User | null> => {
    const u = await apiLogin(mail, password ?? "");
    if (u) {
      setCurrentUser(u);
      saveSession(u.id);
      const fresh = await apiLoadWorkspace();
      setData(healLegacyOverdue(fresh));
    }
    return u;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    saveSession(null);
  }, []);

  // ---- Task creation, incl. all four assignment types -------------------
  const createTask = useCallback((input: TaskInput): Task[] | null => {
    if (!currentUser || !can(currentUser, "create_tasks")) return null;
    const next = structuredClone(data);
    const created: Task[] = [];
    const baseNum = next.tasks.length + 1;
    const userIdsTouchingTask = Array.from(new Set([...input.assignedUserIds, ...input.responsibleMemberIds]));
    const teamsForTaskUsers = Array.from(new Set(
      next.users.filter((user) => userIdsTouchingTask.includes(user.id)).flatMap((user) => user.teamIds)
    ));
    const taskTeamIds = input.assignedTeamIds.length ? input.assignedTeamIds : teamsForTaskUsers;
    const reviewerIds = Array.from(new Set(
      taskTeamIds.flatMap((teamId) => next.teams.find((team) => team.id === teamId)?.leaderIds ?? [])
    ));

    if (currentUser.role === "team_leader") {
      const led = new Set(currentUser.leaderOfTeamIds);
      const touchesOnlyLedTeams = taskTeamIds.every((teamId) => led.has(teamId));
      const usersAllInLedTeams = userIdsTouchingTask.every((userId) => {
        const user = next.users.find((candidate) => candidate.id === userId);
        return !!user && user.teamIds.some((teamId) => led.has(teamId));
      });
      if (!touchesOnlyLedTeams || !usersAllInLedTeams) return null;
    }

    // Individually-owned tasks must be accepted by the assignee before work
    // begins. Team-shared tasks have no single owner to accept, so they start
    // scheduled.
    const initialStatus: TaskStatus =
      input.assignmentType === "team_shared" ? "scheduled" : "pending_acceptance";

    const makeTask = (over: Partial<Task>, idx = 0): Task => ({
      id: uid("tk"),
      taskNumber: `PHX-${String(baseNum + idx).padStart(4, "0")}`,
      title: input.title,
      description: input.description,
      assignmentType: input.assignmentType,
      assignedUserIds: input.assignedUserIds,
      assignedTeamIds: taskTeamIds,
      responsibleMemberIds: input.responsibleMemberIds,
      projectId: input.projectId || undefined,
      category: input.category,
      status: initialStatus,
      priority: input.priority,
      progress: 0,
      startDate: input.startDate || undefined,
      dueDate: input.dueDate,
      estimatedEffort: input.estimatedEffort,
      approvalRequired: input.approvalRequired,
      proofRequired: input.proofRequired,
      checklist: [],
      attachmentUrls: input.attachmentUrls ?? [],
      tags: input.tags,
      createdBy: currentUser.id,
      reviewerIds,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...over,
    });

    if (input.assignmentType === "team_member_copies") {
      const team = next.teams.find((t) => t.id === input.assignedTeamIds[0]);
      const members = team?.memberIds ?? [];
      const parentAssignmentId = `parent_${uid("p")}`;
      members.forEach((mid, i) => {
        created.push(makeTask({ assignedUserIds: [mid], parentAssignmentId }, i));
      });
      next.tasks = [...created, ...next.tasks];
      log(next, created[0]?.id ?? "-", "task_created", undefined, { copies: members.length });
      notify(next, members, "task_assigned", "مهمة جديدة مسندة إليك", input.title);
    } else {
      const t = makeTask({});
      created.push(t);
      next.tasks = [t, ...next.tasks];
      log(next, t.id, input.assignmentType === "team_shared" ? "team_task_created" : "task_created");
      const recipients =
        input.assignmentType === "team_shared"
          ? Array.from(new Set([...(next.teams.find((tm) => tm.id === input.assignedTeamIds[0])?.memberIds ?? []), ...input.responsibleMemberIds]))
          : input.assignedUserIds;
      notify(next, recipients, "task_assigned", "مهمة جديدة مسندة إليك", input.title, t.id);
    }

    commit(next);
    return created;
  }, [currentUser, data, commit, log, notify]);

  const mutateTask = useCallback((taskId: string, fn: (t: Task, next: WorkspaceData) => void, guard?: (t: Task, next: WorkspaceData) => boolean) => {
    const next = structuredClone(data);
    const t = next.tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (guard && !guard(t, next)) return;
    fn(t, next);
    t.updatedAt = nowIso();
    commit(next);
  }, [data, commit]);

  // The assignee confirms an assigned task, or a privileged user (leader of its
  // team / admin / owner) confirms on their behalf — works even when delayed,
  // since the status is real (never frozen at "overdue").
  const acceptTask = useCallback((taskId: string) => {
    mutateTask(
      taskId,
      (t, next) => {
        t.status = "scheduled";
        log(next, taskId, "task_accepted", "pending_acceptance", "scheduled");
        notify(
          next,
          [t.createdBy].filter((rid) => rid !== currentUser?.id),
          "task_accepted", "تم قبول المهمة", t.title, taskId,
        );
      },
      (t, next) => {
        if (!currentUser || t.status !== "pending_acceptance") return false;
        const isAssignee =
          t.assignedUserIds.includes(currentUser.id) || t.responsibleMemberIds.includes(currentUser.id);
        return isAssignee || isElevated(currentUser) || canReviewTask(currentUser, t, next.users);
      },
    );
  }, [mutateTask, log, notify, currentUser]);

  // Edit a task's details (not its assignment). Elevated, the creator, or a leader of its team.
  const updateTask = useCallback((taskId: string, patch: TaskEditPatch) => {
    if (!currentUser) return;
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const allowed = isElevated(currentUser) || task.createdBy === currentUser.id || canEditTaskAdminFields(currentUser, task);
    if (!allowed) return;

    const title = patch.title?.trim();
    if (title !== undefined && title.length < 3) return;
    const description = patch.description?.trim();
    if (description !== undefined && description.length < 1) return;
    if (patch.dueDate !== undefined && !patch.dueDate) return;

    const next = structuredClone(data);
    next.tasks = next.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        title: title ?? t.title,
        description: description ?? t.description,
        priority: patch.priority ?? t.priority,
        startDate: patch.startDate !== undefined ? (patch.startDate || undefined) : t.startDate,
        dueDate: patch.dueDate ?? t.dueDate,
        category: patch.category !== undefined ? (patch.category.trim() || undefined) : t.category,
        projectId: patch.projectId !== undefined ? (patch.projectId || undefined) : t.projectId,
        approvalRequired: patch.approvalRequired ?? t.approvalRequired,
        proofRequired: patch.proofRequired ?? t.proofRequired,
        attachmentUrls: patch.attachmentUrls ?? t.attachmentUrls,
        updatedAt: nowIso(),
      };
    });
    commit(next);
  }, [data, currentUser, commit]);

  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus, extra?: Partial<Task>) => {
    mutateTask(taskId, (t, next) => {
      const prev = t.status;
      t.status = status;
      if (extra) Object.assign(t, extra);
      if (status === "completed") { t.completedAt = nowIso(); t.progress = 100; }
      log(next, taskId, "status_changed", prev, status);
    }, (t, next) => !!currentUser && canWorkOnTask(currentUser, t, next.users));
  }, [mutateTask, log, currentUser]);

  const updateProgress = useCallback((taskId: string, progress: number) => {
    mutateTask(taskId, (t, next) => {
      const prev = t.progress;
      t.progress = progress;
      if (progress > 0 && t.status === "scheduled") t.status = "in_progress";
      log(next, taskId, "progress_updated", prev, progress);
    }, (t, next) => !!currentUser && canWorkOnTask(currentUser, t, next.users));
  }, [mutateTask, log, currentUser]);

  const toggleChecklist = useCallback((taskId: string, itemId: string) => {
    mutateTask(taskId, (t) => {
      t.checklist = t.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
      const done = t.checklist.filter((c) => c.done).length;
      if (t.checklist.length) t.progress = Math.round((done / t.checklist.length) * 100);
    }, (t, next) => !!currentUser && canWorkOnTask(currentUser, t, next.users));
  }, [mutateTask, currentUser]);

  const addComment = useCallback((taskId: string, body: string, mentions: string[]) => {
    if (!currentUser || currentUser.role === "viewer") return;
    const target = data.tasks.find((task) => task.id === taskId);
    if (!target || !canSeeTask(currentUser, target, data.users)) return;
    const next = structuredClone(data);
    next.comments = [{ id: uid("cm"), taskId, userId: currentUser.id, body, mentions, createdAt: nowIso() }, ...next.comments];
    log(next, taskId, "comment_added");
    if (mentions.length) notify(next, mentions, "mention", "أشار إليك أحد الأعضاء", body, taskId);
    commit(next);
  }, [data, currentUser, commit, log, notify]);

  const reportBlocker = useCallback((taskId: string, blocker: Blocker) => {
    mutateTask(taskId, (t, next) => {
      t.status = "blocked";
      t.blocker = blocker;
      log(next, taskId, "blocker_reported", undefined, blocker.description);
      const admins = next.users.filter((u) => u.role === "admin" || u.role === "owner").map((u) => u.id);
      notify(next, admins, "blocker", "عائق يحتاج انتباها", blocker.description, taskId);
    }, (t, next) => !!currentUser && canWorkOnTask(currentUser, t, next.users));
  }, [mutateTask, log, notify, currentUser]);

  const submitForReview = useCallback((taskId: string, extra?: Partial<Task>) => {
    mutateTask(taskId, (t, next) => {
      const prev = t.status;
      if (extra) Object.assign(t, extra);
      if (currentUser && isElevated(currentUser)) {
        t.status = "completed";
        t.progress = 100;
        t.completedAt = nowIso();
        t.review = {
          reviewerId: currentUser.id,
          decision: "approved",
          note: "تم اعتماد المهمة مباشرة بواسطة الإدارة.",
          createdAt: nowIso(),
        };
        log(next, taskId, "task_approved", prev, "completed");
        notify(next, t.assignedUserIds.filter((uid) => uid !== currentUser.id), "approval", "تم اعتماد المهمة", t.title, taskId);
        return;
      }
      t.status = "awaiting_review";
      t.progress = 100;
      log(next, taskId, "task_submitted");
      notify(next, t.reviewerIds.length ? t.reviewerIds : next.users.filter((u) => u.role === "team_leader").map((u) => u.id), "review_requested", "مهمة بانتظار مراجعتك", t.title, taskId);
    }, (t, next) => !!currentUser && canWorkOnTask(currentUser, t, next.users));
  }, [mutateTask, log, notify, currentUser]);

  const reviewTask = useCallback((taskId: string, decision: "approved" | "rejected" | "changes_requested", note: string) => {
    mutateTask(taskId, (t, next) => {
      t.review = { reviewerId: currentUser?.id ?? "system", decision, note, createdAt: nowIso() };
      if (decision === "approved") { t.status = "completed"; t.completedAt = nowIso(); t.progress = 100; }
      else { t.status = "in_progress"; }
      log(next, taskId, decision === "approved" ? "task_approved" : decision === "rejected" ? "task_rejected" : "changes_requested", undefined, note);
      notify(next, t.assignedUserIds, decision === "approved" ? "approval" : "changes_requested", decision === "approved" ? "تم اعتماد عملك" : "طلبت تعديلات", note, taskId);
    }, (t, next) => !!currentUser && canReviewTask(currentUser, t, next.users));
  }, [mutateTask, currentUser, log, notify]);

  const requestExtension = useCallback((taskId: string, input: ExtensionInput) => {
    if (!currentUser) return;
    const task = data.tasks.find((candidate) => candidate.id === taskId);
    if (!task || !canWorkOnTask(currentUser, task, data.users)) return;
    const next = structuredClone(data);
    const ext: ExtensionRequest = {
      id: uid("ext"), taskId, requestedBy: currentUser.id,
      requestedDueDate: input.requestedDueDate, reason: input.reason, notes: input.notes,
      status: "pending", createdAt: nowIso(),
    };
    next.extensions = [ext, ...next.extensions];
    log(next, taskId, "extension_requested", undefined, input.requestedDueDate);
    const t = next.tasks.find((x) => x.id === taskId);
    const reviewers = t?.reviewerIds.length
      ? t.reviewerIds
      : next.users.filter((user) => user.role === "owner" || user.role === "admin").map((user) => user.id);
    notify(next, reviewers.filter((userId) => userId !== currentUser.id), "extension", "طلب تمديد موعد", input.reason, taskId);
    commit(next);
  }, [data, currentUser, commit, log, notify]);

  const reviewExtension = useCallback((extId: string, decision: "approved" | "rejected", note: string) => {
    if (!currentUser) return;
    const next = structuredClone(data);
    const ext = next.extensions.find((e) => e.id === extId);
    if (!ext) return;
    if (ext.status !== "pending") return;
    const task = next.tasks.find((candidate) => candidate.id === ext.taskId);
    if (!task || !canReviewTask(currentUser, task, next.users)) return;
    ext.status = decision;
    ext.reviewedBy = currentUser.id;
    ext.reviewNote = note;
    if (decision === "approved") {
      const t = next.tasks.find((x) => x.id === ext.taskId);
      if (t) { t.dueDate = ext.requestedDueDate; t.updatedAt = nowIso(); }
    }
    log(next, ext.taskId, decision === "approved" ? "extension_approved" : "extension_rejected", undefined, note);
    notify(next, [ext.requestedBy], "extension", decision === "approved" ? "تمت الموافقة على التمديد" : "رفض طلب التمديد", note, ext.taskId);
    commit(next);
  }, [data, currentUser, commit, log, notify]);

  const inviteMember = useCallback((input: InviteInput): Invitation | null => {
    if (!currentUser || !can(currentUser, "invite_members")) return null;
    const next = structuredClone(data);
    const email = input.email.toLowerCase().trim();
    const existingUser = next.users.some((user) => user.email.toLowerCase().trim() === email);
    const existingInvitation = next.invitations.some(
      (invitation) => invitation.email.toLowerCase().trim() === email && invitation.status !== "cancelled"
    );
    if (existingUser || existingInvitation) return null;

    const userId = uid("u");
    const inv: Invitation = {
      id: uid("inv"), email, name: input.name, role: input.role,
      teamIds: input.teamIds, leaderOfTeamIds: input.asLeader ? input.teamIds : [],
      token: invitationToken(), status: "pending", expiresAt: daysFromNow(7),
      invitedBy: currentUser?.id ?? "system", createdAt: nowIso(),
    };
    next.invitations = [inv, ...next.invitations];
    // create an invited user record so member tables reflect it
    next.users = [
      ...next.users,
      {
        id: userId, name: input.name, email, role: input.role,
        teamIds: input.teamIds, leaderOfTeamIds: input.asLeader ? input.teamIds : [],
        accountStatus: "invited", invitationStatus: "pending", createdAt: nowIso(), updatedAt: nowIso(),
      },
    ];
    next.teams = next.teams.map((team) => {
      if (!input.teamIds.includes(team.id)) return team;
      return {
        ...team,
        memberIds: Array.from(new Set([...team.memberIds, userId])),
        leaderIds: input.asLeader ? Array.from(new Set([...team.leaderIds, userId])) : team.leaderIds,
        updatedAt: nowIso(),
      };
    });
    commit(next);
    const markInvitation = (status: Invitation["status"], details?: { messageId?: string; error?: string }) => {
      const updated = structuredClone(next);
      updated.invitations = updated.invitations.map((candidate) =>
        candidate.id === inv.id
          ? {
              ...candidate,
              status,
              emailMessageId: details?.messageId ?? candidate.emailMessageId,
              emailLastSentAt: status === "sent" ? nowIso() : candidate.emailLastSentAt,
              emailLastError: details?.error,
            }
          : candidate
      );
      updated.users = updated.users.map((candidate) =>
        candidate.email.toLowerCase().trim() === email && candidate.accountStatus === "invited"
          ? { ...candidate, invitationStatus: status, updatedAt: nowIso() }
          : candidate
      );
      commit(updated);
    };
    const send = apiSendInvitationEmail(inv, { id: currentUser.id, name: currentUser.name, email: currentUser.email }, currentUser.id);
    void send.then((result) => markInvitation("sent", { messageId: result.id })).catch((error) => {
        console.error("Failed to send invitation email", error);
        markInvitation("failed", { error: error instanceof Error ? error.message : "Unknown email error" });
      });
    return inv;
  }, [data, currentUser, commit]);

  const resendInvitation = useCallback((invId: string) => {
    if (!currentUser || !can(currentUser, "invite_members")) return;
    const invitation = data.invitations.find((candidate) => candidate.id === invId);
    if (!invitation || invitation.status === "cancelled" || invitation.status === "accepted") return;

    const setStatus = (status: Invitation["status"], details?: { messageId?: string; error?: string }) => {
      const next = structuredClone(data);
      next.invitations = next.invitations.map((candidate) =>
        candidate.id === invId
          ? {
              ...candidate,
              status,
              emailMessageId: details?.messageId ?? candidate.emailMessageId,
              emailLastSentAt: status === "sent" ? nowIso() : candidate.emailLastSentAt,
              emailLastError: details?.error,
            }
          : candidate
      );
      next.users = next.users.map((candidate) =>
        candidate.email === invitation.email && candidate.accountStatus === "invited"
          ? { ...candidate, invitationStatus: status, updatedAt: nowIso() }
          : candidate
      );
      commit(next);
    };

    setStatus("pending");
    const send = apiSendInvitationEmail(invitation, { id: currentUser.id, name: currentUser.name, email: currentUser.email }, currentUser.id);
    void send.then((result) => setStatus("sent", { messageId: result.id })).catch((error) => {
      console.error("Failed to resend invitation email", error);
      setStatus("failed", { error: error instanceof Error ? error.message : "Unknown email error" });
    });
  }, [data, currentUser, commit]);

  const cancelInvitation = useCallback((invId: string) => {
    if (!currentUser || !can(currentUser, "invite_members")) return;
    const next = structuredClone(data);
    const inv = next.invitations.find((i) => i.id === invId);
    if (!inv) return;

    const invitedUserIds = next.users
      .filter((user) => user.email === inv.email && user.accountStatus === "invited")
      .map((user) => user.id);
    next.invitations = next.invitations.filter((invitation) => invitation.id !== invId);
    next.users = next.users.filter((user) => !invitedUserIds.includes(user.id));
    next.teams = next.teams.map((team) => ({
      ...team,
      memberIds: team.memberIds.filter((memberId) => !invitedUserIds.includes(memberId)),
      leaderIds: team.leaderIds.filter((leaderId) => !invitedUserIds.includes(leaderId)),
      updatedAt:
        team.memberIds.some((memberId) => invitedUserIds.includes(memberId)) ||
        team.leaderIds.some((leaderId) => invitedUserIds.includes(leaderId))
          ? nowIso()
          : team.updatedAt,
    }));
    commit(next);
  }, [data, commit, currentUser]);

  const updateMemberRole = useCallback((userId: string, role: User["role"]) => {
    if (!currentUser || !can(currentUser, "manage_members")) return;
    if (role === "owner") return;
    const next = structuredClone(data);
    const target = next.users.find((user) => user.id === userId);
    if (!target || target.id === currentUser.id || target.role === "owner") return;

    const leaderOfTeamIds = role === "team_leader" ? target.leaderOfTeamIds : [];
    next.users = next.users.map((user) =>
      user.id === userId ? { ...user, role, leaderOfTeamIds, updatedAt: nowIso() } : user
    );
    if (role !== "team_leader") {
      next.teams = next.teams.map((team) => ({
        ...team,
        leaderIds: team.leaderIds.filter((leaderId) => leaderId !== userId),
        updatedAt: team.leaderIds.includes(userId) ? nowIso() : team.updatedAt,
      }));
    }
    next.invitations = next.invitations.map((invitation) =>
      invitation.email.toLowerCase().trim() === target.email.toLowerCase().trim() && invitation.status !== "accepted"
        ? { ...invitation, role, leaderOfTeamIds }
        : invitation
    );
    commit(next);
  }, [data, commit, currentUser]);

  const updateMyProfile = useCallback((profile: UserProfileInput) => {
    if (!currentUser) return;
    const next = structuredClone(data);
    let updatedUser: User | null = null;
    next.users = next.users.map((user) => {
      if (user.id !== currentUser.id) return user;
      updatedUser = {
        ...user,
        profile: {
          jobTitle: profile.jobTitle,
          phone: profile.phone,
          location: profile.location,
          bio: profile.bio,
          skills: profile.skills,
          cvUrl: profile.cvUrl,
          portfolioUrl: profile.portfolioUrl,
        },
        updatedAt: nowIso(),
      };
      return updatedUser;
    });
    if (!updatedUser) return;
    setCurrentUser(updatedUser);
    commit(next);
  }, [data, commit, currentUser]);

  // -- Create --------------------------------------------------------------
  const createTeam = useCallback((input: TeamInput): Team | null => {
    if (!currentUser || !isElevated(currentUser)) return null;
    const next = structuredClone(data);
    const members = Array.from(new Set([...(input.memberIds ?? []), ...(input.leaderId ? [input.leaderId] : [])]));
    const team: Team = {
      id: uid("t"), name: input.name, description: input.description ?? "", icon: "users",
      leaderIds: input.leaderId ? [input.leaderId] : [], memberIds: members,
      createdBy: currentUser.id, createdAt: nowIso(), updatedAt: nowIso(),
    };
    next.teams = [team, ...next.teams];
    // reflect membership + leadership on user records
    next.users = next.users.map((u) => {
      if (!members.includes(u.id)) return u;
      const teamIds = Array.from(new Set([...u.teamIds, team.id]));
      const leaderOfTeamIds = input.leaderId === u.id ? Array.from(new Set([...u.leaderOfTeamIds, team.id])) : u.leaderOfTeamIds;
      const role = input.leaderId === u.id && u.role === "member" ? ("team_leader" as const) : u.role;
      return { ...u, teamIds, leaderOfTeamIds, role, updatedAt: nowIso() };
    });
    commit(next);
    return team;
  }, [data, currentUser, commit]);

  // Rename a team / edit its description.
  const updateTeam = useCallback((teamId: string, input: { name: string; description?: string }) => {
    if (!currentUser) return;
    const team = data.teams.find((t) => t.id === teamId);
    if (!team) return;
    const canManageTeam = isElevated(currentUser) || currentUser.leaderOfTeamIds.includes(teamId);
    if (!canManageTeam) return;
    const name = input.name.trim();
    if (name.length < 2) return;
    const next = structuredClone(data);
    next.teams = next.teams.map((t) =>
      t.id === teamId ? { ...t, name, description: input.description?.trim() ?? t.description, updatedAt: nowIso() } : t
    );
    commit(next);
  }, [data, currentUser, commit]);

  // Promote a member to team leader or demote a leader back to member.
  const setTeamLeadership = useCallback((teamId: string, userId: string, makeLeader: boolean) => {
    if (!currentUser || !isElevated(currentUser)) return;
    const team = data.teams.find((t) => t.id === teamId);
    if (!team || !team.memberIds.includes(userId)) return;
    const next = structuredClone(data);
    next.teams = next.teams.map((t) => {
      if (t.id !== teamId) return t;
      const leaderIds = makeLeader
        ? Array.from(new Set([...t.leaderIds, userId]))
        : t.leaderIds.filter((id) => id !== userId);
      return { ...t, leaderIds, updatedAt: nowIso() };
    });
    next.users = next.users.map((u) => {
      if (u.id !== userId) return u;
      const leaderOfTeamIds = makeLeader
        ? Array.from(new Set([...u.leaderOfTeamIds, teamId]))
        : u.leaderOfTeamIds.filter((id) => id !== teamId);
      let role = u.role;
      if (makeLeader && u.role === "member") role = "team_leader";
      if (!makeLeader && u.role === "team_leader" && leaderOfTeamIds.length === 0) role = "member";
      return { ...u, leaderOfTeamIds, role, updatedAt: nowIso() };
    });
    commit(next);
  }, [data, currentUser, commit]);

  // Add one or more existing members to a team's roster.
  const addTeamMembers = useCallback((teamId: string, userIds: string[], asLeader = false) => {
    if (!currentUser) return;
    const team = data.teams.find((t) => t.id === teamId);
    if (!team) return;
    const canManageTeam = isElevated(currentUser) || currentUser.leaderOfTeamIds.includes(teamId);
    if (!canManageTeam) return;
    // promoting to leader requires elevated rights
    const promote = asLeader && isElevated(currentUser);

    const toAdd = userIds.filter(
      (id) => data.users.some((u) => u.id === id) && !team.memberIds.includes(id)
    );
    if (toAdd.length === 0) return;

    const next = structuredClone(data);
    next.teams = next.teams.map((t) =>
      t.id === teamId
        ? {
            ...t,
            memberIds: Array.from(new Set([...t.memberIds, ...toAdd])),
            leaderIds: promote ? Array.from(new Set([...t.leaderIds, ...toAdd])) : t.leaderIds,
            updatedAt: nowIso(),
          }
        : t
    );
    next.users = next.users.map((u) => {
      if (!toAdd.includes(u.id)) return u;
      const leaderOfTeamIds = promote ? Array.from(new Set([...u.leaderOfTeamIds, teamId])) : u.leaderOfTeamIds;
      const role = promote && u.role === "member" ? ("team_leader" as const) : u.role;
      return { ...u, teamIds: Array.from(new Set([...u.teamIds, teamId])), leaderOfTeamIds, role, updatedAt: nowIso() };
    });
    notify(
      next,
      toAdd.filter((id) => id !== currentUser.id),
      "team_membership",
      "إضافة إلى فريق",
      `تمت إضافتك إلى فريق ${team.name}`
    );
    commit(next);
  }, [data, currentUser, commit, notify]);

  // Remove a member from a single team (without deleting their account).
  const removeTeamMember = useCallback((teamId: string, userId: string) => {
    if (!currentUser) return;
    const team = data.teams.find((t) => t.id === teamId);
    if (!team || !team.memberIds.includes(userId)) return;
    const canManageTeam = isElevated(currentUser) || currentUser.leaderOfTeamIds.includes(teamId);
    if (!canManageTeam) return;

    const next = structuredClone(data);
    next.teams = next.teams.map((t) =>
      t.id === teamId
        ? {
            ...t,
            memberIds: t.memberIds.filter((m) => m !== userId),
            leaderIds: t.leaderIds.filter((m) => m !== userId),
            updatedAt: nowIso(),
          }
        : t
    );
    next.users = next.users.map((u) => {
      if (u.id !== userId) return u;
      const leaderOfTeamIds = u.leaderOfTeamIds.filter((t) => t !== teamId);
      // demote a leader who no longer leads any team
      const role = u.role === "team_leader" && leaderOfTeamIds.length === 0 ? ("member" as const) : u.role;
      return {
        ...u,
        teamIds: u.teamIds.filter((t) => t !== teamId),
        leaderOfTeamIds,
        role,
        updatedAt: nowIso(),
      };
    });
    // Roster change only: direct task assignments are independent of team
    // membership and must be left intact (contrast removeMember, which deletes
    // the whole account and cascades unassignment).
    commit(next);
  }, [data, currentUser, commit]);

  const createProject = useCallback((input: ProjectInput): Project | null => {
    if (!currentUser || !isElevated(currentUser)) return null;
    const next = structuredClone(data);
    const project: Project = {
      id: uid("p"), name: input.name, description: input.description ?? "",
      managerId: input.managerId ?? currentUser.id, teamIds: input.teamIds ?? [],
      startDate: input.startDate || nowIso(), endDate: input.endDate || undefined,
      progress: 0, status: "planned", priority: input.priority,
      createdAt: nowIso(), updatedAt: nowIso(),
    };
    next.projects = [project, ...next.projects];
    commit(next);
    return project;
  }, [data, currentUser, commit]);

  const updateProject = useCallback((id: string, patch: ProjectEditPatch) => {
    if (!currentUser || !isElevated(currentUser)) return;
    const project = data.projects.find((p) => p.id === id);
    if (!project) return;
    const name = patch.name?.trim();
    if (name !== undefined && name.length < 2) return;
    const next = structuredClone(data);
    next.projects = next.projects.map((p) =>
      p.id === id
        ? {
            ...p,
            name: name ?? p.name,
            description: patch.description !== undefined ? patch.description.trim() : p.description,
            teamIds: patch.teamIds ?? p.teamIds,
            managerId: patch.managerId ?? p.managerId,
            startDate: patch.startDate || p.startDate,
            endDate: patch.endDate !== undefined ? (patch.endDate || undefined) : p.endDate,
            priority: patch.priority ?? p.priority,
            status: patch.status ?? p.status,
            updatedAt: nowIso(),
          }
        : p
    );
    commit(next);
  }, [data, currentUser, commit]);

  const createAnnouncement = useCallback((input: AnnouncementInput): Announcement | null => {
    if (!currentUser || !can(currentUser, "manage_announcements")) return null;
    if (currentUser.role === "team_leader") {
      if (input.audienceType !== "teams" || input.audienceIds.length === 0) return null;
      if (input.audienceIds.some((teamId) => !currentUser.leaderOfTeamIds.includes(teamId))) return null;
    }
    const next = structuredClone(data);
    const ann: Announcement = {
      id: uid("ann"), title: input.title, body: input.body, authorId: currentUser.id,
      audience: { type: input.audienceType, ids: input.audienceIds ?? [] },
      priority: input.priority, requireAck: input.requireAck,
      publishedAt: nowIso(), readBy: [], acknowledgedBy: [],
    };
    next.announcements = [ann, ...next.announcements];
    // notify the audience
    const recipients = input.audienceType === "all"
      ? next.users.filter((u) => u.accountStatus === "active").map((u) => u.id)
      : next.users.filter((u) => u.teamIds.some((t) => input.audienceIds.includes(t))).map((u) => u.id);
    notify(next, recipients.filter((r) => r !== currentUser.id), "announcement", "إعلان جديد", input.title);
    commit(next);
    return ann;
  }, [data, currentUser, commit, notify]);

  const updateAnnouncement = useCallback((id: string, patch: AnnouncementEditPatch) => {
    if (!currentUser) return;
    const ann = data.announcements.find((a) => a.id === id);
    if (!ann || !canManageAnnouncement(currentUser, ann)) return;

    const audienceType = patch.audienceType ?? (ann.audience.type === "projects" ? "teams" : ann.audience.type);
    const audienceIds = patch.audienceIds ?? ann.audience.ids;
    if (currentUser.role === "team_leader") {
      if (audienceType !== "teams" || audienceIds.length === 0) return;
      if (audienceIds.some((teamId) => !currentUser.leaderOfTeamIds.includes(teamId))) return;
    }
    const title = patch.title?.trim();
    if (title !== undefined && title.length < 2) return;
    const body = patch.body?.trim();
    if (body !== undefined && body.length < 1) return;

    const next = structuredClone(data);
    next.announcements = next.announcements.map((a) =>
      a.id === id
        ? {
            ...a,
            title: title ?? a.title,
            body: body ?? a.body,
            priority: patch.priority ?? a.priority,
            audience: { type: audienceType, ids: audienceType === "all" ? [] : audienceIds },
            requireAck: patch.requireAck ?? a.requireAck,
          }
        : a
    );
    commit(next);
  }, [data, currentUser, commit]);

  const acknowledgeAnnouncement = useCallback((id: string) => {
    if (!currentUser) return;
    const target = data.announcements.find((announcement) => announcement.id === id);
    if (!target || !canSeeAnnouncement(currentUser, target)) return;
    const next = structuredClone(data);
    next.announcements = next.announcements.map((a) =>
      a.id === id
        ? {
            ...a,
            acknowledgedBy: a.acknowledgedBy.includes(currentUser.id) ? a.acknowledgedBy : [...a.acknowledgedBy, currentUser.id],
            readBy: a.readBy.includes(currentUser.id) ? a.readBy : [...a.readBy, currentUser.id],
          }
        : a
    );
    commit(next);
  }, [data, currentUser, commit]);

  // -- Delete / destructive ------------------------------------------------
  const deleteTask = useCallback((taskId: string) => {
    const next = structuredClone(data);
    const target = next.tasks.find((t) => t.id === taskId);
    if (!target) return;
    if (!canDeleteTask(currentUser, target, next.users)) return;
    // cascade: child copies, comments, activities, extensions, notifications
    const idsToRemove = new Set<string>([taskId, ...next.tasks.filter((t) => t.parentAssignmentId === taskId).map((t) => t.id)]);
    next.tasks = next.tasks.filter((t) => !idsToRemove.has(t.id));
    next.comments = next.comments.filter((c) => !idsToRemove.has(c.taskId));
    next.activities = next.activities.filter((a) => !idsToRemove.has(a.taskId));
    next.extensions = next.extensions.filter((e) => !idsToRemove.has(e.taskId));
    next.notifications = next.notifications.filter((n) => !n.taskId || !idsToRemove.has(n.taskId));
    commit(next);
  }, [data, commit, currentUser]);

  const deleteTeam = useCallback((teamId: string) => {
    if (!isElevated(currentUser)) return;
    const next = structuredClone(data);
    next.teams = next.teams.filter((t) => t.id !== teamId);
    // strip team from user memberships/leadership
    next.users = next.users.map((u) => ({
      ...u,
      teamIds: u.teamIds.filter((t) => t !== teamId),
      leaderOfTeamIds: u.leaderOfTeamIds.filter((t) => t !== teamId),
    }));
    // strip team from tasks; team_shared/copies tasks left with no team are removed
    const orphanTaskIds = new Set<string>();
    next.tasks = next.tasks.map((t) => {
      if (!t.assignedTeamIds.includes(teamId)) return t;
      const assignedTeamIds = t.assignedTeamIds.filter((x) => x !== teamId);
      if (assignedTeamIds.length === 0 && t.assignedUserIds.length === 0 && t.responsibleMemberIds.length === 0) orphanTaskIds.add(t.id);
      return { ...t, assignedTeamIds };
    });
    next.tasks = next.tasks.filter((t) => !orphanTaskIds.has(t.id));
    next.projects = next.projects.map((p) => ({ ...p, teamIds: p.teamIds.filter((t) => t !== teamId) }));
    commit(next);
  }, [data, commit, currentUser]);

  const deleteProject = useCallback((projectId: string) => {
    if (!isElevated(currentUser)) return;
    const next = structuredClone(data);
    next.projects = next.projects.filter((p) => p.id !== projectId);
    // unlink tasks (keep the tasks themselves)
    next.tasks = next.tasks.map((t) => (t.projectId === projectId ? { ...t, projectId: undefined } : t));
    commit(next);
  }, [data, commit, currentUser]);

  const deleteAnnouncement = useCallback((id: string) => {
    if (!currentUser) return;
    const target = data.announcements.find((announcement) => announcement.id === id);
    if (!target || !canManageAnnouncement(currentUser, target)) return;
    const next = structuredClone(data);
    next.announcements = next.announcements.filter((a) => a.id !== id);
    commit(next);
  }, [data, commit, currentUser]);

  const deleteComment = useCallback((commentId: string) => {
    if (!currentUser) return;
    const next = structuredClone(data);
    const comment = next.comments.find((c) => c.id === commentId);
    if (!comment) return;
    const task = next.tasks.find((candidate) => candidate.id === comment.taskId);
    if (comment.userId !== currentUser.id && !isElevated(currentUser) && (!task || !canDeleteTask(currentUser, task, next.users))) return;
    next.comments = next.comments.filter((c) => c.id !== commentId);
    commit(next);
  }, [data, commit, currentUser]);

  const setMemberStatus = useCallback((userId: string, status: "active" | "suspended") => {
    if (!currentUser || !can(currentUser, "suspend_accounts")) return;
    const next = structuredClone(data);
    const target = next.users.find((u) => u.id === userId);
    if (!target || target.role === "owner" || target.id === currentUser.id) return;
    next.users = next.users.map((u) => (u.id === userId ? { ...u, accountStatus: status, updatedAt: nowIso() } : u));
    commit(next);
  }, [data, commit, currentUser]);

  const removeMember = useCallback((userId: string) => {
    if (!currentUser || !can(currentUser, "manage_members")) return;
    const next = structuredClone(data);
    const target = next.users.find((u) => u.id === userId);
    if (!target || target.role === "owner" || target.id === currentUser.id) return;
    next.users = next.users.filter((u) => u.id !== userId);
    // remove from team rosters/leadership
    next.teams = next.teams.map((t) => ({
      ...t,
      memberIds: t.memberIds.filter((m) => m !== userId),
      leaderIds: t.leaderIds.filter((m) => m !== userId),
    }));
    // unassign from tasks; individual tasks left with no assignee are removed
    const orphan = new Set<string>();
    next.tasks = next.tasks.map((t) => {
      const assignedUserIds = t.assignedUserIds.filter((x) => x !== userId);
      const responsibleMemberIds = t.responsibleMemberIds.filter((x) => x !== userId);
      const changed = { ...t, assignedUserIds, responsibleMemberIds };
      if (assignedUserIds.length === 0 && t.assignedTeamIds.length === 0 && responsibleMemberIds.length === 0) orphan.add(t.id);
      return changed;
    });
    next.tasks = next.tasks.filter((t) => !orphan.has(t.id));
    commit(next);
  }, [data, commit, currentUser]);

  const markRead = useCallback((id: string) => {
    if (!currentUser) return;
    const next = structuredClone(data);
    const target = next.notifications.find((n) => n.id === id);
    if (!target || target.recipientId !== currentUser.id) return;
    next.notifications = next.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    commit(next);
  }, [data, commit, currentUser]);

  const markAllRead = useCallback(() => {
    const next = structuredClone(data);
    next.notifications = next.notifications.map((n) =>
      n.recipientId === currentUser?.id ? { ...n, read: true } : n
    );
    commit(next);
  }, [data, currentUser, commit]);

  const value = useMemo<Ctx>(() => ({
    ready, currentUser, data, login, logout,
    createTask, acceptTask, updateTask, updateTaskStatus, updateProgress, toggleChecklist, addComment,
    reportBlocker, submitForReview, reviewTask, requestExtension, reviewExtension,
    inviteMember, resendInvitation, cancelInvitation, updateMemberRole, updateMyProfile, markRead, markAllRead,
    createTeam, updateTeam, addTeamMembers, removeTeamMember, setTeamLeadership, createProject, updateProject, createAnnouncement, updateAnnouncement, acknowledgeAnnouncement,
    deleteTask, deleteTeam, deleteProject, deleteAnnouncement, deleteComment,
    setMemberStatus, removeMember,
  }), [ready, currentUser, data, login, logout, createTask, acceptTask, updateTask, updateTaskStatus, updateProgress, toggleChecklist, addComment, reportBlocker, submitForReview, reviewTask, requestExtension, reviewExtension, inviteMember, resendInvitation, cancelInvitation, updateMemberRole, updateMyProfile, markRead, markAllRead, createTeam, updateTeam, addTeamMembers, removeTeamMember, setTeamLeadership, createProject, updateProject, createAnnouncement, updateAnnouncement, acknowledgeAnnouncement, deleteTask, deleteTeam, deleteProject, deleteAnnouncement, deleteComment, setMemberStatus, removeMember]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
