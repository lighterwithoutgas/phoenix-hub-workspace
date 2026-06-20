"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type {
  WorkspaceData, User, Task, TaskStatus, Notification, Invitation,
  Blocker, ExtensionRequest, Team, Project, Announcement,
} from "./types";
import type {
  TaskInput, InviteInput, ExtensionInput,
  TeamInput, ProjectInput, AnnouncementInput,
} from "./schemas";
import { loadSession, saveSession } from "./session";
import { apiLoadWorkspace, apiLogin, apiPersistWorkspace, apiSendInvitationEmail } from "./api/workspace";
import { uid, nowIso, daysFromNow, isOverdue } from "./utils";
import {
  can, canDeleteTask, canManageAnnouncement, canReviewTask, canSeeAnnouncement, canSeeTask, canWorkOnTask, isElevated,
} from "./permissions";

interface Ctx {
  ready: boolean;
  currentUser: User | null;
  data: WorkspaceData;
  login: (email: string, password?: string) => Promise<User | null>;
  logout: () => void;
  // actions
  createTask: (input: TaskInput) => Task[] | null;
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
  markRead: (id: string) => void;
  markAllRead: () => void;
  // create
  createTeam: (input: TeamInput) => Team | null;
  createProject: (input: ProjectInput) => Project | null;
  createAnnouncement: (input: AnnouncementInput) => Announcement | null;
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

const markOverdue = (d: WorkspaceData): WorkspaceData => ({
  ...d,
  tasks: d.tasks.map((t) =>
    isOverdue(t.dueDate, t.status) && t.status !== "blocked" && t.status !== "awaiting_review"
      ? { ...t, status: "overdue" as TaskStatus }
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
        const d = markOverdue(await apiLoadWorkspace());
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
    return next;
  }, []);

  const login = useCallback(async (mail: string, password?: string): Promise<User | null> => {
    const u = await apiLogin(mail, password ?? "");
    if (u) {
      setCurrentUser(u);
      saveSession(u.id);
      const fresh = await apiLoadWorkspace();
      setData(markOverdue(fresh));
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
      status: "scheduled",
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
      t.status = "awaiting_review";
      t.progress = 100;
      if (extra) Object.assign(t, extra);
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
    notify(next, t?.reviewerIds ?? [], "extension", "طلب تمديد موعد", input.reason, taskId);
    commit(next);
  }, [data, currentUser, commit, log, notify]);

  const reviewExtension = useCallback((extId: string, decision: "approved" | "rejected", note: string) => {
    if (!currentUser) return;
    const next = structuredClone(data);
    const ext = next.extensions.find((e) => e.id === extId);
    if (!ext) return;
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
    const userId = uid("u");
    const inv: Invitation = {
      id: uid("inv"), email: input.email, name: input.name, role: input.role,
      teamIds: input.teamIds, leaderOfTeamIds: input.asLeader ? input.teamIds : [],
      token: invitationToken(), status: "pending", expiresAt: daysFromNow(7),
      invitedBy: currentUser?.id ?? "system", createdAt: nowIso(),
    };
    next.invitations = [inv, ...next.invitations];
    // create an invited user record so member tables reflect it
    next.users = [
      ...next.users,
      {
        id: userId, name: input.name, email: input.email, role: input.role,
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
    const markInvitation = (status: Invitation["status"]) => {
      const updated = structuredClone(next);
      updated.invitations = updated.invitations.map((candidate) =>
        candidate.id === inv.id ? { ...candidate, status } : candidate
      );
      updated.users = updated.users.map((candidate) =>
        candidate.email === input.email && candidate.accountStatus === "invited"
          ? { ...candidate, invitationStatus: status, updatedAt: nowIso() }
          : candidate
      );
      commit(updated);
    };
    const send = apiSendInvitationEmail(inv, { id: currentUser.id, name: currentUser.name, email: currentUser.email }, currentUser.id);
    void send.then(() => markInvitation("sent")).catch((error) => {
        console.error("Failed to send invitation email", error);
        markInvitation("failed");
      });
    return inv;
  }, [data, currentUser, commit]);

  const resendInvitation = useCallback((invId: string) => {
    if (!currentUser || !can(currentUser, "invite_members")) return;
    const invitation = data.invitations.find((candidate) => candidate.id === invId);
    if (!invitation || invitation.status === "cancelled" || invitation.status === "accepted") return;

    const setStatus = (status: Invitation["status"]) => {
      const next = structuredClone(data);
      next.invitations = next.invitations.map((candidate) =>
        candidate.id === invId ? { ...candidate, status } : candidate
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
    void send.then(() => setStatus("sent")).catch((error) => {
      console.error("Failed to resend invitation email", error);
      setStatus("failed");
    });
  }, [data, currentUser, commit]);

  const cancelInvitation = useCallback((invId: string) => {
    if (!currentUser || !can(currentUser, "invite_members")) return;
    const next = structuredClone(data);
    const inv = next.invitations.find((i) => i.id === invId);
    next.invitations = next.invitations.map((i) => (i.id === invId ? { ...i, status: "cancelled" as const } : i));
    // remove the placeholder "invited" user record if it matches
    if (inv) next.users = next.users.filter((u) => !(u.email === inv.email && u.accountStatus === "invited"));
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
    createTask, updateTaskStatus, updateProgress, toggleChecklist, addComment,
    reportBlocker, submitForReview, reviewTask, requestExtension, reviewExtension,
    inviteMember, resendInvitation, cancelInvitation, markRead, markAllRead,
    createTeam, createProject, createAnnouncement, acknowledgeAnnouncement,
    deleteTask, deleteTeam, deleteProject, deleteAnnouncement, deleteComment,
    setMemberStatus, removeMember,
  }), [ready, currentUser, data, login, logout, createTask, updateTaskStatus, updateProgress, toggleChecklist, addComment, reportBlocker, submitForReview, reviewTask, requestExtension, reviewExtension, inviteMember, resendInvitation, cancelInvitation, markRead, markAllRead, createTeam, createProject, createAnnouncement, acknowledgeAnnouncement, deleteTask, deleteTeam, deleteProject, deleteAnnouncement, deleteComment, setMemberStatus, removeMember]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
