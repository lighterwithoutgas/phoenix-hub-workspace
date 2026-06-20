import type {
  WorkspaceData, User, Team, Task, Project, Notification,
  TaskActivity, Announcement, Comment,
} from "../types";
import { daysFromNow, nowIso } from "../utils";

function user(p: Partial<User> & Pick<User, "id" | "name" | "email" | "role">): User {
  return {
    avatarUrl: undefined,
    teamIds: [],
    leaderOfTeamIds: [],
    accountStatus: "active",
    lastActiveAt: daysFromNow(0),
    createdAt: daysFromNow(-120),
    updatedAt: nowIso(),
    ...p,
  };
}

export function buildSeed(): WorkspaceData {
  // -- Users ---------------------------------------------------------------
  const users: User[] = [
    user({ id: "u_owner", name: "محمود الحلبي", email: "owner@phoenixhub.org", role: "owner", teamIds: ["t_ops"] }),
    user({ id: "u_admin", name: "ريم الناصر", email: "admin@phoenixhub.org", role: "admin", teamIds: ["t_ops"] }),
    user({ id: "u_leader", name: "أحمد خليل", email: "leader@phoenixhub.org", role: "team_leader", teamIds: ["t_media"], leaderOfTeamIds: ["t_media"] }),
    user({ id: "u_member", name: "لينا حمدان", email: "member@phoenixhub.org", role: "member", teamIds: ["t_media"] }),
    user({ id: "u_omar", name: "عمر سعيد", email: "omar@phoenixhub.org", role: "member", teamIds: ["t_media"] }),
    user({ id: "u_sara", name: "سارة يوسف", email: "sara@phoenixhub.org", role: "member", teamIds: ["t_media"] }),
    user({ id: "u_tlead", name: "خالد عوض", email: "tlead@phoenixhub.org", role: "team_leader", teamIds: ["t_tech"], leaderOfTeamIds: ["t_tech"] }),
    user({ id: "u_dev1", name: "نور درويش", email: "dev1@phoenixhub.org", role: "member", teamIds: ["t_tech"] }),
    user({ id: "u_viewer", name: "هبة قاسم", email: "viewer@phoenixhub.org", role: "viewer", teamIds: [] }),
    user({ id: "u_invited", name: "يوسف عابد", email: "yousef@phoenixhub.org", role: "member", teamIds: ["t_media"], accountStatus: "invited", invitationStatus: "sent" }),
  ];

  // -- Teams ---------------------------------------------------------------
  const teams: Team[] = [
    { id: "t_media", name: "فريق الإعلام", icon: "megaphone", description: "إنتاج المحتوى والتصميم والتغطيات الإعلامية", leaderIds: ["u_leader"], memberIds: ["u_leader", "u_member", "u_omar", "u_sara"], createdBy: "u_owner", createdAt: daysFromNow(-100), updatedAt: nowIso() },
    { id: "t_tech", name: "الفريق التقني", icon: "code", description: "تطوير المنصات والأنظمة الداخلية", leaderIds: ["u_tlead"], memberIds: ["u_tlead", "u_dev1"], createdBy: "u_owner", createdAt: daysFromNow(-90), updatedAt: nowIso() },
    { id: "t_ops", name: "فريق العمليات", icon: "settings", description: "التنسيق والإدارة والتقارير", leaderIds: [], memberIds: ["u_owner", "u_admin"], createdBy: "u_owner", createdAt: daysFromNow(-110), updatedAt: nowIso() },
  ];

  // -- Projects ------------------------------------------------------------
  const projects: Project[] = [
    { id: "p_campaign", name: "الحملة الشهرية", description: "حملة التوعية المجتمعية لشهر يونيو", managerId: "u_admin", teamIds: ["t_media"], startDate: daysFromNow(-15), endDate: daysFromNow(20), progress: 45, status: "active", priority: "high", createdAt: daysFromNow(-15), updatedAt: nowIso() },
    { id: "p_platform", name: "منصة Phoenix الداخلية", description: "تطوير منصة العمليات الداخلية", managerId: "u_owner", teamIds: ["t_tech"], startDate: daysFromNow(-40), endDate: daysFromNow(60), progress: 60, status: "active", priority: "urgent", createdAt: daysFromNow(-40), updatedAt: nowIso() },
  ];

  const baseTask = (id: string, num: number): Pick<Task, "id" | "taskNumber" | "createdBy" | "reviewerIds" | "attachmentUrls" | "createdAt" | "updatedAt"> => ({
    id, taskNumber: `PHX-${String(num).padStart(4, "0")}`, createdBy: "u_admin",
    reviewerIds: ["u_leader"], attachmentUrls: [], createdAt: daysFromNow(-8), updatedAt: nowIso(),
  });

  // -- Tasks (all four assignment types) -----------------------------------
  const tasks: Task[] = [
    {
      ...baseTask("tk_1", 1),
      title: "تصميم منشورات الحملة الشهرية", description: "إعداد ٦ منشورات بصرية للحملة وفق دليل الهوية.",
      assignmentType: "individual", assignedUserIds: ["u_member"], assignedTeamIds: ["t_media"], responsibleMemberIds: [],
      projectId: "p_campaign", category: "تصميم", status: "in_progress", priority: "high", progress: 60,
      startDate: daysFromNow(-5), dueDate: daysFromNow(3), estimatedEffort: 8,
      approvalRequired: true, proofRequired: true,
      checklist: [
        { id: "c1", label: "تجهيز القالب", done: true },
        { id: "c2", label: "تصميم ٣ منشورات", done: true },
        { id: "c3", label: "تصميم ٣ منشورات إضافية", done: false },
        { id: "c4", label: "مراجعة الألوان", done: false },
      ],
      tags: ["تصميم", "حملة"],
    },
    {
      ...baseTask("tk_2", 2),
      title: "إعداد فيديو تعريفي مشترك", description: "مونتاج وإخراج فيديو مدته دقيقتان بالتعاون بين عضوين.",
      assignmentType: "multiple_members_shared", assignedUserIds: ["u_member", "u_omar"], assignedTeamIds: ["t_media"], responsibleMemberIds: [],
      projectId: "p_campaign", category: "مونتاج", status: "in_progress", priority: "medium", progress: 35,
      startDate: daysFromNow(-3), dueDate: daysFromNow(6), estimatedEffort: 12,
      approvalRequired: true, proofRequired: false,
      checklist: [
        { id: "c1", label: "كتابة السيناريو", done: true },
        { id: "c2", label: "تصوير المشاهد", done: false },
        { id: "c3", label: "المونتاج النهائي", done: false },
      ],
      tags: ["فيديو"],
    },
    {
      ...baseTask("tk_3", 3),
      title: "إعداد تقرير الحملة الشهرية", description: "تقرير شامل عن أداء الحملة يُسند إلى فريق الإعلام بالكامل.",
      assignmentType: "team_shared", assignedUserIds: [], assignedTeamIds: ["t_media"], responsibleMemberIds: ["u_member", "u_omar", "u_sara"],
      projectId: "p_campaign", category: "تقارير", status: "in_progress", priority: "high", progress: 50,
      startDate: daysFromNow(-6), dueDate: daysFromNow(5), estimatedEffort: 16,
      approvalRequired: true, proofRequired: true,
      checklist: [
        { id: "c1", label: "جمع الإحصاءات", done: true },
        { id: "c2", label: "تحليل التفاعل", done: true },
        { id: "c3", label: "كتابة الملخص التنفيذي", done: false },
      ],
      tags: ["تقرير", "فريق"],
    },
    {
      ...baseTask("tk_4", 4),
      title: "مراجعة محتوى صفحات السوشال", description: "مهمة متوقفة بانتظار اعتماد الهوية الجديدة.",
      assignmentType: "individual", assignedUserIds: ["u_omar"], assignedTeamIds: ["t_media"], responsibleMemberIds: [],
      projectId: "p_campaign", category: "محتوى", status: "blocked", priority: "medium", progress: 20,
      startDate: daysFromNow(-4), dueDate: daysFromNow(2), estimatedEffort: 4,
      approvalRequired: false, proofRequired: false,
      blocker: { type: "اعتماد", description: "بانتظار اعتماد دليل الهوية الجديد من الإدارة.", helpNeeded: "اعتماد دليل الهوية", blockedBy: "u_admin", expectedResolution: daysFromNow(1) },
      checklist: [], tags: ["محتوى"],
    },
    {
      ...baseTask("tk_5", 5),
      title: "تدقيق نصوص النشرة الإخبارية", description: "تدقيق لغوي للنشرة قبل النشر.",
      assignmentType: "individual", assignedUserIds: ["u_sara"], assignedTeamIds: ["t_media"], responsibleMemberIds: [],
      projectId: "p_campaign", category: "تدقيق", status: "awaiting_review", priority: "medium", progress: 100,
      startDate: daysFromNow(-7), dueDate: daysFromNow(1), estimatedEffort: 3,
      approvalRequired: true, proofRequired: true, proofUrl: "newsletter-final.pdf",
      checklist: [{ id: "c1", label: "تدقيق لغوي", done: true }, { id: "c2", label: "تنسيق", done: true }],
      tags: ["تدقيق"],
    },
    {
      ...baseTask("tk_6", 6),
      title: "أرشفة صور الفعالية السابقة", description: "تنظيم وأرشفة مكتبة الصور — تجاوزت الموعد.",
      assignmentType: "individual", assignedUserIds: ["u_member"], assignedTeamIds: ["t_media"], responsibleMemberIds: [],
      category: "أرشفة", status: "in_progress", priority: "low", progress: 40,
      startDate: daysFromNow(-12), dueDate: daysFromNow(-2), estimatedEffort: 5,
      approvalRequired: false, proofRequired: false, checklist: [], tags: ["أرشيف"],
    },
    {
      ...baseTask("tk_7", 7),
      title: "نشر تغطية الفعالية", description: "مهمة مكتملة ومعتمدة.",
      assignmentType: "individual", assignedUserIds: ["u_omar"], assignedTeamIds: ["t_media"], responsibleMemberIds: [],
      projectId: "p_campaign", category: "نشر", status: "completed", priority: "medium", progress: 100,
      startDate: daysFromNow(-14), dueDate: daysFromNow(-5), estimatedEffort: 4,
      approvalRequired: true, proofRequired: false,
      review: { reviewerId: "u_leader", decision: "approved", note: "عمل ممتاز", createdAt: daysFromNow(-5) },
      completedAt: daysFromNow(-5), checklist: [], tags: ["نشر"],
    },
    {
      ...baseTask("tk_8", 8),
      title: "اختبار وحدة تسجيل الدخول", description: "اختبار شامل لوحدة المصادقة.",
      assignmentType: "individual", assignedUserIds: ["u_dev1"], assignedTeamIds: ["t_tech"], responsibleMemberIds: [],
      projectId: "p_platform", category: "اختبار", status: "in_progress", priority: "urgent", progress: 70,
      startDate: daysFromNow(-3), dueDate: daysFromNow(2), estimatedEffort: 6,
      approvalRequired: true, proofRequired: true, createdBy: "u_owner", reviewerIds: ["u_tlead"],
      checklist: [{ id: "c1", label: "اختبار الحالات الناجحة", done: true }, { id: "c2", label: "اختبار الأخطاء", done: false }],
      tags: ["اختبار", "أمان"],
    },
  ];

  // team_member_copies — generate one copy per media member
  const mediaMembers = teams[0].memberIds;
  mediaMembers.forEach((mid, i) => {
    tasks.push({
      ...baseTask(`tk_copy_${i}`, 20 + i),
      title: "تعبئة استبيان التقييم الذاتي", description: "نسخة مستقلة لكل عضو في فريق الإعلام لتعبئة التقييم الذاتي الشهري.",
      assignmentType: "team_member_copies", assignedUserIds: [mid], assignedTeamIds: ["t_media"], responsibleMemberIds: [],
      parentAssignmentId: "parent_eval_june", category: "إداري",
      status: i === 0 ? "completed" : "scheduled", priority: "low", progress: i === 0 ? 100 : 0,
      startDate: daysFromNow(-1), dueDate: daysFromNow(7), estimatedEffort: 1,
      approvalRequired: false, proofRequired: false,
      completedAt: i === 0 ? nowIso() : undefined, checklist: [], tags: ["تقييم"],
    });
  });

  // -- Comments ------------------------------------------------------------
  const comments: Comment[] = [
    { id: "cm1", taskId: "tk_3", userId: "u_member", body: "أنجزت قسم الإحصاءات، يرجى المراجعة @عمر", mentions: ["u_omar"], createdAt: daysFromNow(-2) },
    { id: "cm2", taskId: "tk_3", userId: "u_leader", body: "ممتاز، تابعوا الملخص التنفيذي.", mentions: [], createdAt: daysFromNow(-1) },
    { id: "cm3", taskId: "tk_1", userId: "u_leader", body: "انتبهي لتباين الألوان مع دليل الهوية.", mentions: ["u_member"], createdAt: daysFromNow(-1) },
  ];

  // -- Activity ------------------------------------------------------------
  const activities: TaskActivity[] = [
    { id: "a1", taskId: "tk_1", userId: "u_admin", action: "task_created", createdAt: daysFromNow(-8) },
    { id: "a2", taskId: "tk_1", userId: "u_member", action: "status_changed", previousValue: "scheduled", newValue: "in_progress", createdAt: daysFromNow(-5) },
    { id: "a3", taskId: "tk_1", userId: "u_member", action: "progress_updated", previousValue: 30, newValue: 60, createdAt: daysFromNow(-1) },
    { id: "a4", taskId: "tk_4", userId: "u_omar", action: "blocker_reported", newValue: "بانتظار اعتماد الهوية", createdAt: daysFromNow(-1) },
    { id: "a5", taskId: "tk_5", userId: "u_sara", action: "task_submitted", createdAt: daysFromNow(-1) },
    { id: "a6", taskId: "tk_7", userId: "u_leader", action: "task_approved", createdAt: daysFromNow(-5) },
    { id: "a7", taskId: "tk_3", userId: "u_admin", action: "team_task_created", newValue: "فريق الإعلام", createdAt: daysFromNow(-6) },
  ];

  // -- Notifications -------------------------------------------------------
  const notifications: Notification[] = [
    { id: "n1", recipientId: "u_member", taskId: "tk_1", type: "task_assigned", title: "مهمة جديدة مسندة إليك", message: "تم إسناد: تصميم منشورات الحملة الشهرية", deliveryMethods: ["in_app", "email", "push"], read: false, deliveryStatus: "delivered", createdAt: daysFromNow(-8) },
    { id: "n2", recipientId: "u_member", taskId: "tk_3", type: "team_task", title: "مهمة فريق جديدة", message: "تم إسناد مهمة إلى فريق الإعلام: إعداد تقرير الحملة الشهرية", deliveryMethods: ["in_app", "email"], read: false, deliveryStatus: "delivered", createdAt: daysFromNow(-6) },
    { id: "n3", recipientId: "u_member", taskId: "tk_1", type: "mention", title: "أشار إليك أحمد خليل", message: "انتبهي لتباين الألوان مع دليل الهوية.", deliveryMethods: ["in_app"], read: true, deliveryStatus: "delivered", createdAt: daysFromNow(-1) },
    { id: "n4", recipientId: "u_leader", taskId: "tk_5", type: "review_requested", title: "مهمة بانتظار مراجعتك", message: "أرسلت سارة يوسف: تدقيق نصوص النشرة الإخبارية", deliveryMethods: ["in_app", "email"], read: false, deliveryStatus: "delivered", createdAt: daysFromNow(-1) },
    { id: "n5", recipientId: "u_admin", taskId: "tk_4", type: "blocker", title: "عائق يحتاج انتباهاً", message: "مهمة متوقفة: مراجعة محتوى صفحات السوشال", deliveryMethods: ["in_app"], read: false, deliveryStatus: "delivered", createdAt: daysFromNow(-1) },
  ];

  // -- Announcements -------------------------------------------------------
  const announcements: Announcement[] = [
    { id: "an1", title: "اجتماع الفرق الأسبوعي", body: "يُعقد الاجتماع الأسبوعي يوم الأحد الساعة ١٠ صباحاً عبر المنصة. الحضور إلزامي لقادة الفرق.", authorId: "u_admin", audience: { type: "all", ids: [] }, priority: "high", requireAck: true, publishedAt: daysFromNow(-2), readBy: ["u_leader", "u_member"], acknowledgedBy: ["u_leader"] },
    { id: "an2", title: "تحديث دليل الهوية البصرية", body: "تم اعتماد دليل الهوية الجديد. يرجى اعتماده في جميع التصاميم القادمة.", authorId: "u_owner", audience: { type: "teams", ids: ["t_media"] }, priority: "medium", requireAck: false, publishedAt: daysFromNow(-4), readBy: ["u_member", "u_omar"], acknowledgedBy: [] },
  ];

  return { users, teams, tasks, activities, notifications, invitations: [], projects, announcements, comments, extensions: [] };
}
