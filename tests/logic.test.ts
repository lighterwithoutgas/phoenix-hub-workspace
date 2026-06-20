import { buildSeed } from "../src/lib/mock/seed";
import { tasksFor, myTasks, teamTasks, tasksOfTeam } from "../src/lib/selectors";
import {
  can,
  canManageAnnouncement,
  canSeeAnnouncement,
  canSeeTask,
  canSeeTeam,
  canReviewTask,
  canWorkOnTask,
  isElevated,
  canDeleteTask,
} from "../src/lib/permissions";
import { teamSchema, projectSchema, announcementSchema } from "../src/lib/schemas";
import type { WorkspaceData, User } from "../src/lib/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; console.log(`  \u2717 FAIL: ${name}`); }
}

const data: WorkspaceData = buildSeed();
const u = (id: string) => data.users.find((x) => x.id === id)!;

console.log("\n— Seed integrity —");
check("10 users seeded", data.users.length === 10);
check("3 teams seeded", data.teams.length === 3);
check("team_member_copies expanded into per-member tasks", data.tasks.some((t) => t.parentAssignmentId));
const copyParent = data.tasks.find((t) => t.id === "parent_eval_june");
const copies = data.tasks.filter((t) => t.parentAssignmentId === "parent_eval_june");
check("copy parent has >=2 child copies (one per member)", copies.length >= 2);
check("all 4 assignment types present", ["individual","multiple_members_shared","team_shared","team_member_copies"]
  .every((t) => data.tasks.some((x) => x.assignmentType === t)));

console.log("\n— RBAC: elevated sees everything —");
const owner = u("u_owner"), admin = u("u_admin");
check("owner is elevated", isElevated(owner));
check("owner sees all tasks", tasksFor(data, owner).length === data.tasks.length);
check("admin sees all tasks", tasksFor(data, admin).length === data.tasks.length);

console.log("\n— RBAC: team leader scoping —");
const leader = u("u_leader");      // leads t_media
const tlead = u("u_tlead");        // leads t_tech
const leaderVisible = tasksFor(data, leader);
const techTasks = data.tasks.filter((t) => t.assignedTeamIds.includes("t_tech"));
check("media leader cannot see tech-only team task",
  !leaderVisible.some((t) => t.assignmentType === "team_shared" && t.assignedTeamIds.includes("t_tech") && !t.assignedTeamIds.includes("t_media")));
check("media leader sees own team's shared tasks",
  leaderVisible.some((t) => t.assignmentType === "team_shared" && t.assignedTeamIds.includes("t_media")));
check("media team rollup includes individual member tasks",
  tasksOfTeam(data.tasks, "t_media", data.users).some((t) => t.assignmentType === "individual" && t.assignedUserIds.includes("u_member")));
check("seed media individual tasks are denormalized with t_media for Firebase rules",
  data.tasks.filter((t) => t.assignedUserIds.some((id) => ["u_member", "u_omar", "u_sara"].includes(id))).every((t) => t.assignedTeamIds.includes("t_media")));
check("media leader can open media team details", canSeeTeam(leader, data.teams.find((t) => t.id === "t_media")!));
check("media leader cannot open tech team details", !canSeeTeam(leader, data.teams.find((t) => t.id === "t_tech")!));
check("media member cannot open tech team details", !canSeeTeam(u("u_member"), data.teams.find((t) => t.id === "t_tech")!));
// cross check via canSeeTask on a pure tech team task
const techTeamTask = techTasks.find((t) => t.assignmentType === "team_shared");
if (techTeamTask) check("canSeeTask: media leader blocked from tech team task", !canSeeTask(leader, techTeamTask, data.users));

console.log("\n— RBAC: member scoping —");
const member = u("u_member");      // t_media member
const memVisible = tasksFor(data, member);
check("member sees only tasks they're allowed", memVisible.every((t) => canSeeTask(member, t, data.users)));
check("member's myTasks ⊆ visible", myTasks(memVisible, member.id).every((t) => memVisible.includes(t)));
const otherIndiv = data.tasks.find((t) => t.assignmentType === "individual" && !t.assignedUserIds.includes(member.id) && !t.assignedTeamIds.some((tid) => member.teamIds.includes(tid)));
if (otherIndiv) check("member cannot see unrelated individual task", !canSeeTask(member, otherIndiv, data.users));

console.log("\n— Review: no self-approval —");
const awaiting = data.tasks.find((t) => t.status === "awaiting_review");
if (awaiting) {
  // a member can never review
  check("member cannot review", !canReviewTask(member, awaiting, data.users));
  // a viewer can never review
  check("viewer cannot review", !canReviewTask(u("u_viewer"), awaiting, data.users));
  check("media leader can see awaiting individual member task", canSeeTask(leader, awaiting, data.users));
  check("media leader can review awaiting individual member task", canReviewTask(leader, awaiting, data.users));
  check("tech leader cannot see media member individual task", !canSeeTask(tlead, awaiting, data.users));
}
// construct: leader reviewing a task they are assigned to -> blocked
const selfTask = { ...data.tasks[0], assignmentType: "team_shared" as const, assignedTeamIds: ["t_media"], assignedUserIds: [leader.id], status: "awaiting_review" as const };
check("leader cannot approve a task they're assigned to (no self-approval)", !canReviewTask(leader, selfTask, data.users));
const adminSelfTask = { ...data.tasks[0], assignedUserIds: [admin.id], createdBy: "u_owner", reviewerIds: [admin.id], status: "awaiting_review" as const };
check("admin cannot approve a task assigned to themselves", !canReviewTask(admin, adminSelfTask, data.users));

console.log("\n— Work permissions —");
check("viewer cannot work on any task", data.tasks.every((t) => !canWorkOnTask(u("u_viewer"), t, data.users)));

console.log("\n— Overdue logic (runtime auto-mark) —");
import { isOverdue } from "../src/lib/utils";
const hydrated = data.tasks.map((t) =>
  isOverdue(t.dueDate, t.status) && t.status !== "blocked" && t.status !== "awaiting_review"
    ? { ...t, status: "overdue" as const } : t);
check("a past-due task exists in seed", data.tasks.some((t) => new Date(t.dueDate) < new Date() && !["completed","cancelled"].includes(t.status)));
check("auto-mark flips past-due task to overdue", hydrated.some((t) => t.status === "overdue"));
check("a completed task exists", data.tasks.some((t) => t.status === "completed"));
check("a blocked task with blocker detail exists", data.tasks.some((t) => t.status === "blocked" && !!t.blocker));

console.log("\n— Delete permissions (canDeleteTask) —");
const anyTask = data.tasks[0];
check("admin can delete any task", canDeleteTask(admin, anyTask));
check("owner can delete any task", canDeleteTask(owner, anyTask));
const memberOwnTask = data.tasks.find((t) => t.assignmentType === "individual" && t.assignedUserIds.includes(member.id));
if (memberOwnTask) check("plain member cannot delete a task they did not create", !canDeleteTask(member, memberOwnTask, data.users) || memberOwnTask.createdBy === member.id);
check("viewer cannot delete tasks", data.tasks.every((t) => !canDeleteTask(u("u_viewer"), t, data.users)));
const mediaTeamTask = data.tasks.find((t) => t.assignmentType === "team_shared" && t.assignedTeamIds.includes("t_media"));
if (mediaTeamTask) check("media leader can delete their team's task", canDeleteTask(leader, mediaTeamTask, data.users));
if (mediaTeamTask) check("tech leader cannot delete media team's task", !canDeleteTask(tlead, mediaTeamTask, data.users));

console.log("\n— Announcement permissions —");
check("team leader has announcement creation capability", can(leader, "manage_announcements"));
check("member does not have announcement creation capability", !can(member, "manage_announcements"));
const mediaAnnouncement = {
  id: "ann_media_test", title: "Media only", body: "x", authorId: leader.id,
  audience: { type: "teams" as const, ids: ["t_media"] },
  priority: "medium" as const, requireAck: false, publishedAt: new Date().toISOString(),
  readBy: [], acknowledgedBy: [],
};
const techAnnouncement = { ...mediaAnnouncement, id: "ann_tech_test", audience: { type: "teams" as const, ids: ["t_tech"] } };
check("media leader can manage own announcement", canManageAnnouncement(leader, mediaAnnouncement));
check("media member can see media announcement", canSeeAnnouncement(member, mediaAnnouncement));
check("media member cannot see tech announcement", !canSeeAnnouncement(member, techAnnouncement));

console.log("\n— Create validation schemas —");
check("teamSchema rejects short name", !teamSchema.safeParse({ name: "x" }).success);
check("teamSchema accepts valid input", teamSchema.safeParse({ name: "فريق جديد", memberIds: ["u_member"], leaderId: "u_member" }).success);
check("projectSchema accepts valid input", projectSchema.safeParse({ name: "مشروع", teamIds: ["t_media"], priority: "high" }).success);
check("announcementSchema rejects empty body", !announcementSchema.safeParse({ title: "عنوان", body: "" }).success);
check("announcementSchema accepts valid input", announcementSchema.safeParse({ title: "عنوان", body: "نص", priority: "medium", audienceType: "all" }).success);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
