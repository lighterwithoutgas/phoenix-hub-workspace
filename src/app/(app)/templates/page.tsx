"use client";

import Link from "next/link";
import { FileStack, Plus, User2, Users, Users2, Copy } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { assignmentAr, priorityAr } from "@/lib/arabic";
import type { AssignmentType, TaskPriority } from "@/lib/types";

const TEMPLATES: { id: string; title: string; desc: string; type: AssignmentType; priority: TaskPriority }[] = [
  { id: "weekly_report", title: "تقرير أسبوعي", desc: "تقرير دوري عن إنجازات الأسبوع لكل عضو.", type: "team_member_copies", priority: "medium" },
  { id: "content_piece", title: "إنتاج قطعة محتوى", desc: "من الفكرة إلى النشر مع قائمة تحقق كاملة.", type: "individual", priority: "high" },
  { id: "campaign_launch", title: "إطلاق حملة", desc: "مهمة فريق مشتركة لتنسيق إطلاق حملة.", type: "team_shared", priority: "urgent" },
  { id: "design_review", title: "مراجعة تصميم", desc: "مهمة مشتركة بين المصمم والمراجع.", type: "multiple_members_shared", priority: "medium" },
];

const typeIcon: Record<AssignmentType, React.ElementType> = {
  individual: User2, multiple_members_shared: Users, team_shared: Users2, team_member_copies: Copy,
};

export default function TemplatesPage() {
  const { currentUser } = useWorkspace();
  if (!currentUser) return null;

  if (!can(currentUser, "create_tasks")) {
    return <div className="card card-pad text-center"><EmptyState title="غير مصرح" hint="القوالب متاحة للمدراء وقادة الفرق." icon={FileStack} /></div>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">قوالب المهام</h1>
          <p className="meta mt-1">ابدأ مهمة جديدة من قالب جاهز لتوفير الوقت</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TEMPLATES.map((t) => {
          const Icon = typeIcon[t.type];
          return (
            <div key={t.id} className="card card-pad phoenix-motif">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-card bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-bold text-on-surface">{t.title}</h3>
                  <p className="meta">{assignmentAr[t.type]} · {priorityAr[t.priority]}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">{t.desc}</p>
              <Link href={`/tasks/new?type=${t.type}`} className="btn-outline mt-3 w-full justify-center gap-2"><Plus className="h-4 w-4" /> استخدام القالب</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
