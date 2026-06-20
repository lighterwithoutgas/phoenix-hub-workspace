import type { WorkspaceData, User, Task, Team } from "./types";
import { canSeeTask } from "./permissions";

export function getUser(data: WorkspaceData, id: string): User | undefined {
  return data.users.find((u) => u.id === id);
}
export function getTeam(data: WorkspaceData, id: string): Team | undefined {
  return data.teams.find((t) => t.id === id);
}
export function userName(data: WorkspaceData, id: string): string {
  return getUser(data, id)?.name ?? "—";
}

// All tasks a user is allowed to see (the visibility spine for the whole UI).
export function tasksFor(data: WorkspaceData, user: User): Task[] {
  return data.tasks.filter((task) => canSeeTask(user, task, data.users));
}

// "My work" — tasks where the user is personally an assignee/responsible.
export function myTasks(tasks: Task[], userId: string): Task[] {
  return tasks.filter(
    (t) => t.assignedUserIds.includes(userId) || t.responsibleMemberIds.includes(userId)
  );
}

// Team-owned tasks among a set.
export function teamTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.assignmentType === "team_shared" && t.assignedTeamIds.length > 0);
}

export function tasksOfTeam(tasks: Task[], teamId: string, users: User[] = []): Task[] {
  const memberIds = new Set(users.filter((user) => user.teamIds.includes(teamId)).map((user) => user.id));
  return tasks.filter(
    (task) =>
      task.assignedTeamIds.includes(teamId) ||
      task.assignedUserIds.some((userId) => memberIds.has(userId)) ||
      task.responsibleMemberIds.some((userId) => memberIds.has(userId))
  );
}

export function membersOfTeam(data: WorkspaceData, teamId: string): User[] {
  const team = getTeam(data, teamId);
  if (!team) return [];
  return team.memberIds.map((id) => getUser(data, id)).filter(Boolean) as User[];
}

export type StatusKey = Task["status"];
export function countByStatus(tasks: Task[]): Record<StatusKey, number> {
  const init: Record<StatusKey, number> = {
    scheduled: 0, in_progress: 0, blocked: 0, awaiting_review: 0,
    completed: 0, cancelled: 0, overdue: 0,
  };
  for (const t of tasks) init[t.status] = (init[t.status] ?? 0) + 1;
  return init;
}

export function completionRate(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "completed").length;
  return Math.round((done / tasks.length) * 100);
}

export function onTimeRate(tasks: Task[]): number {
  const completed = tasks.filter((t) => t.status === "completed");
  if (completed.length === 0) return 0;
  const onTime = completed.filter(
    (t) => !t.completedAt || new Date(t.completedAt) <= new Date(t.dueDate)
  ).length;
  return Math.round((onTime / completed.length) * 100);
}
