import type { User, Task, Team, UserRole, Announcement } from "./types";

export type Capability =
  | "manage_workspace"
  | "manage_teams"
  | "manage_members"
  | "manage_tasks"
  | "approve_tasks"
  | "access_analytics"
  | "manage_announcements"
  | "export_reports"
  | "access_activity_log"
  | "invite_members"
  | "create_tasks"
  | "assign_leaders"
  | "suspend_accounts";

const MATRIX: Record<UserRole, Capability[]> = {
  owner: [
    "manage_workspace", "manage_teams", "manage_members", "manage_tasks",
    "approve_tasks", "access_analytics", "manage_announcements", "export_reports",
    "access_activity_log", "invite_members", "create_tasks", "assign_leaders",
    "suspend_accounts",
  ],
  admin: [
    "manage_teams", "manage_members", "manage_tasks", "approve_tasks",
    "access_analytics", "manage_announcements", "export_reports",
    "access_activity_log", "invite_members", "create_tasks", "assign_leaders",
    "suspend_accounts",
  ],
  team_leader: [
    "manage_tasks", "approve_tasks", "access_analytics", "create_tasks",
    "access_activity_log", "manage_announcements",
  ],
  member: [],
  viewer: ["export_reports"],
};

export function can(user: User | null, cap: Capability): boolean {
  if (!user) return false;
  return MATRIX[user.role]?.includes(cap) ?? false;
}

export function isElevated(user: User | null): boolean {
  return !!user && (user.role === "owner" || user.role === "admin");
}

// Which teams can this user see fully?
export function visibleTeamIds(user: User): string[] {
  if (isElevated(user)) return ["*"];
  if (user.role === "team_leader") return user.leaderOfTeamIds;
  return user.teamIds;
}

function taskTouchesLedTeam(user: User, task: Task, users: User[] = []): boolean {
  if (user.role !== "team_leader") return false;
  const led = new Set(user.leaderOfTeamIds);
  if (task.assignedTeamIds.some((teamId) => led.has(teamId))) return true;

  const taskUsers = new Set([...task.assignedUserIds, ...task.responsibleMemberIds]);
  return users.some((candidate) => taskUsers.has(candidate.id) && candidate.teamIds.some((teamId) => led.has(teamId)));
}

// Core task-visibility rule used everywhere (the security spine).
export function canSeeTask(user: User, task: Task, users: User[] = []): boolean {
  if (isElevated(user)) return true;

  const myTeams = new Set(user.teamIds);

  // Direct or shared assignee
  if (task.assignedUserIds.includes(user.id)) return true;
  if (task.responsibleMemberIds.includes(user.id)) return true;
  if (task.reviewerIds.includes(user.id)) return true;

  // Team tasks for teams I belong to
  if (task.assignedTeamIds.some((t) => myTeams.has(t))) return true;

  // Team leader: every task touching a team I lead, including individual member tasks.
  return taskTouchesLedTeam(user, task, users);
}

// Can the user edit restricted/admin fields (due date, approval flags, etc.)?
export function canEditTaskAdminFields(user: User, task: Task): boolean {
  if (isElevated(user)) return true;
  if (user.role === "team_leader") {
    return task.assignedTeamIds.some((t) => user.leaderOfTeamIds.includes(t));
  }
  return false;
}

// Can the user update progress/status (do the work)?
export function canWorkOnTask(user: User, task: Task, users: User[] = []): boolean {
  if (user.role === "viewer") return false;
  if (isElevated(user)) return true;
  if (task.assignedUserIds.includes(user.id)) return true;
  if (task.responsibleMemberIds.includes(user.id)) return true;
  return taskTouchesLedTeam(user, task, users);
}

// Reviewers cannot approve their own work unless elevated.
export function canReviewTask(user: User, task: Task, users: User[] = []): boolean {
  if (user.role === "viewer" || user.role === "member") return false;
  if (isElevated(user)) return true;
  const isDoingWork = task.assignedUserIds.includes(user.id) || task.responsibleMemberIds.includes(user.id);
  if (isDoingWork) return false;
  if (user.role === "team_leader") {
    return task.reviewerIds.includes(user.id) || taskTouchesLedTeam(user, task, users);
  }
  return false;
}

export function canSeeTeam(user: User, team: Team): boolean {
  if (isElevated(user)) return true;
  return user.teamIds.includes(team.id) || user.leaderOfTeamIds.includes(team.id);
}

export function teamLeaderNames(team: Team, users: User[]): string[] {
  return team.leaderIds
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter(Boolean) as string[];
}

// Can the user delete this task? Elevated, the creator, or a leader of its team.
export function canDeleteTask(user: User | null, task: Task, users: User[] = []): boolean {
  if (!user) return false;
  if (isElevated(user)) return true;
  if (task.createdBy === user.id) return true;
  return taskTouchesLedTeam(user, task, users);
}

export function canSeeAnnouncement(user: User, announcement: Announcement): boolean {
  if (isElevated(user) || announcement.authorId === user.id) return true;
  if (announcement.audience.type === "all") return true;

  const visibleTeamIds = new Set([...user.teamIds, ...user.leaderOfTeamIds]);
  return announcement.audience.type === "teams" && announcement.audience.ids.some((teamId) => visibleTeamIds.has(teamId));
}

export function canManageAnnouncement(user: User | null, announcement?: Announcement): boolean {
  if (!user) return false;
  if (isElevated(user)) return true;
  return user.role === "team_leader" && (!announcement || announcement.authorId === user.id);
}
