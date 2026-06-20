// ---------------------------------------------------------------------------
// Phoenix Hub Workspace - Domain Models (type-safe)
// All identifiers/enums in English; UI labels resolved in lib/arabic.ts
// ---------------------------------------------------------------------------

// Timestamps are stored as ISO strings.
export type Timestamp = string;

export type UserRole = "owner" | "admin" | "team_leader" | "member" | "viewer";

export type AccountStatus = "active" | "suspended" | "invited";

export type AssignmentType =
  | "individual"
  | "multiple_members_shared"
  | "team_shared"
  | "team_member_copies";

export type TaskStatus =
  | "scheduled"
  | "in_progress"
  | "blocked"
  | "awaiting_review"
  | "completed"
  | "cancelled"
  | "overdue";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type InvitationStatus =
  | "pending"
  | "sent"
  | "opened"
  | "accepted"
  | "expired"
  | "cancelled"
  | "failed";

export type ProjectStatus =
  | "planned"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  teamIds: string[];
  leaderOfTeamIds: string[];
  accountStatus: AccountStatus;
  invitationStatus?: InvitationStatus;
  passwordHash?: string;
  lastActiveAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  leaderIds: string[];
  memberIds: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Blocker {
  type: string;
  description: string;
  helpNeeded: string;
  blockedBy: string;
  expectedResolution?: Timestamp;
}

export interface ExtensionRequest {
  id: string;
  taskId: string;
  requestedBy: string;
  requestedDueDate: Timestamp;
  reason: string;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: Timestamp;
}

export interface Review {
  reviewerId: string;
  decision: "approved" | "rejected" | "changes_requested";
  note?: string;
  createdAt: Timestamp;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  mentions: string[];
  createdAt: Timestamp;
}

export interface Task {
  id: string;
  taskNumber: string;
  title: string;
  description: string;

  assignmentType: AssignmentType;
  assignedUserIds: string[];
  assignedTeamIds: string[];
  responsibleMemberIds: string[];
  parentAssignmentId?: string;

  projectId?: string;
  category?: string;

  status: TaskStatus;
  priority: TaskPriority;
  progress: number;

  startDate?: Timestamp;
  dueDate: Timestamp;
  estimatedEffort?: number;

  approvalRequired: boolean;
  proofRequired: boolean;

  checklist: ChecklistItem[];
  attachmentUrls: string[];
  tags: string[];

  blocker?: Blocker;
  cancellation?: { reason: string; description: string };
  review?: Review;
  proofUrl?: string;

  createdBy: string;
  reviewerIds: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface Notification {
  id: string;
  recipientId: string;
  taskId?: string;
  type: string;
  title: string;
  message: string;
  deliveryMethods: Array<"in_app" | "push" | "email">;
  read: boolean;
  deliveryStatus: string;
  createdAt: Timestamp;
}

export interface Invitation {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teamIds: string[];
  leaderOfTeamIds: string[];
  token: string;
  status: InvitationStatus;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  invitedBy: string;
  createdAt: Timestamp;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  managerId: string;
  teamIds: string[];
  startDate: Timestamp;
  endDate?: Timestamp;
  progress: number;
  status: ProjectStatus;
  priority: TaskPriority;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  authorId: string;
  audience: { type: "all" | "teams" | "projects"; ids: string[] };
  priority: TaskPriority;
  requireAck: boolean;
  publishedAt: Timestamp;
  expiresAt?: Timestamp;
  readBy: string[];
  acknowledgedBy: string[];
}

export interface WorkspaceData {
  users: User[];
  teams: Team[];
  tasks: Task[];
  activities: TaskActivity[];
  notifications: Notification[];
  invitations: Invitation[];
  projects: Project[];
  announcements: Announcement[];
  comments: Comment[];
  extensions: ExtensionRequest[];
}
