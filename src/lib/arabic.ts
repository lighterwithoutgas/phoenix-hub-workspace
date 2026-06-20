import type {
  AccountStatus,
  AssignmentType,
  InvitationStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
} from "./types";

export const roleAr: Record<UserRole, string> = {
  owner: "مالك المساحة",
  admin: "مدير النظام",
  team_leader: "قائد الفريق",
  member: "عضو الفريق",
  viewer: "مشاهد / مدقق",
};

export const statusAr: Record<TaskStatus, string> = {
  scheduled: "مجدولة",
  in_progress: "قيد التنفيذ",
  blocked: "متوقفة",
  awaiting_review: "بانتظار المراجعة",
  completed: "مكتملة",
  cancelled: "ملغاة",
  overdue: "متأخرة",
};

export const priorityAr: Record<TaskPriority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

export const assignmentAr: Record<AssignmentType, string> = {
  individual: "مهمة فردية",
  multiple_members_shared: "مهمة مشتركة بين عدة أعضاء",
  team_shared: "مهمة فريق مشتركة",
  team_member_copies: "نسخة مستقلة لكل عضو في الفريق",
};

export const invitationAr: Record<InvitationStatus, string> = {
  pending: "بانتظار الإرسال",
  sent: "تم الإرسال",
  opened: "تم الفتح",
  accepted: "تم القبول",
  expired: "منتهية",
  cancelled: "ملغاة",
  failed: "فشل الإرسال",
};

export const projectStatusAr: Record<ProjectStatus, string> = {
  planned: "مخطط",
  active: "نشط",
  paused: "متوقف مؤقتا",
  completed: "مكتمل",
  cancelled: "ملغى",
};

export const accountStatusAr: Record<AccountStatus, string> = {
  active: "نشط",
  suspended: "معلق",
  invited: "مدعو",
};

export const statusTone: Record<TaskStatus, string> = {
  scheduled: "outline",
  in_progress: "secondary",
  blocked: "coral",
  awaiting_review: "amber",
  completed: "secondary",
  cancelled: "outline",
  overdue: "error",
};

export const priorityTone: Record<TaskPriority, string> = {
  low: "outline",
  medium: "secondary",
  high: "amber",
  urgent: "error",
};

const arNum = new Intl.NumberFormat("ar-EG");

export function fmtNum(n: number): string {
  return arNum.format(n);
}

export function fmtDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "-";
  }
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "-";
  }
}

export function fmtRelative(iso?: string): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(-days, "day");
}
