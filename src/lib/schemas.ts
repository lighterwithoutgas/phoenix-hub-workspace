import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("يرجى إدخال بريد إلكتروني صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
  remember: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const taskSchema = z
  .object({
    title: z.string().min(3, "عنوان المهمة مطلوب (٣ أحرف على الأقل)"),
    description: z.string().min(1, "الوصف مطلوب"),
    assignmentType: z.enum([
      "individual",
      "multiple_members_shared",
      "team_shared",
      "team_member_copies",
    ]),
    assignedUserIds: z.array(z.string()).default([]),
    assignedTeamIds: z.array(z.string()).default([]),
    responsibleMemberIds: z.array(z.string()).default([]),
    projectId: z.string().optional(),
    category: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    startDate: z.string().optional(),
    dueDate: z.string().min(1, "تاريخ الاستحقاق مطلوب"),
    estimatedEffort: z.number().optional(),
    approvalRequired: z.boolean().default(false),
    proofRequired: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    attachmentUrls: z.array(z.string().url("رابط غير صالح")).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.assignmentType === "individual" && data.assignedUserIds.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["assignedUserIds"], message: "اختر عضواً واحداً للمهمة الفردية" });
    }
    if (data.assignmentType === "multiple_members_shared" && data.assignedUserIds.length < 2) {
      ctx.addIssue({ code: "custom", path: ["assignedUserIds"], message: "اختر عضوين على الأقل للمهمة المشتركة" });
    }
    if (
      (data.assignmentType === "team_shared" || data.assignmentType === "team_member_copies") &&
      data.assignedTeamIds.length !== 1
    ) {
      ctx.addIssue({ code: "custom", path: ["assignedTeamIds"], message: "اختر فريقاً واحداً" });
    }
  });
export type TaskInput = z.infer<typeof taskSchema>;

export const inviteSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  role: z.enum(["owner", "admin", "team_leader", "member", "viewer"]),
  teamIds: z.array(z.string()).default([]),
  asLeader: z.boolean().default(false),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const blockerSchema = z.object({
  type: z.string().min(1, "نوع العائق مطلوب"),
  description: z.string().min(1, "شرح العائق مطلوب"),
  helpNeeded: z.string().min(1, "المساعدة المطلوبة مطلوبة"),
  blockedBy: z.string().min(1, "حدد الشخص أو الفريق المطلوب"),
  expectedResolution: z.string().optional(),
});
export type BlockerInput = z.infer<typeof blockerSchema>;

export const extensionSchema = z.object({
  requestedDueDate: z.string().min(1, "الموعد الجديد مطلوب"),
  reason: z.string().min(1, "سبب الطلب مطلوب"),
  notes: z.string().optional(),
});
export type ExtensionInput = z.infer<typeof extensionSchema>;

export const teamSchema = z.object({
  name: z.string().min(2, "اسم الفريق مطلوب (حرفان على الأقل)"),
  description: z.string().optional(),
  memberIds: z.array(z.string()).default([]),
  leaderId: z.string().optional(),
});
export type TeamInput = z.infer<typeof teamSchema>;

export const projectSchema = z.object({
  name: z.string().min(2, "اسم المشروع مطلوب"),
  description: z.string().optional(),
  teamIds: z.array(z.string()).default([]),
  managerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const announcementSchema = z.object({
  title: z.string().min(2, "عنوان الإعلان مطلوب"),
  body: z.string().min(1, "محتوى الإعلان مطلوب"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  audienceType: z.enum(["all", "teams"]).default("all"),
  audienceIds: z.array(z.string()).default([]),
  requireAck: z.boolean().default(false),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;
