"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import { tasksFor } from "@/lib/selectors";
import { TaskList } from "@/components/TaskList";

export default function AllTasksPage() {
  const { currentUser, data } = useWorkspace();
  const params = useSearchParams();
  const all = useMemo(() => (currentUser ? tasksFor(data, currentUser) : []), [data, currentUser]);
  const status = params.get("status");
  const q = params.get("q")?.toLowerCase() ?? "";

  const earlyNull = !currentUser;
  const filtered = useMemo(() => {
    let list = all;
    if (status) list = list.filter((t) => t.status === status);
    if (q) list = list.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.taskNumber.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
    return list;
  }, [all, status, q]);

  if (earlyNull) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">جميع المهام</h1>
        <p className="meta mt-1">كل المهام التي تملك صلاحية رؤيتها{q ? ` · نتائج البحث عن "${q}"` : ""}</p>
      </header>
      <TaskList tasks={filtered} data={data} />
    </div>
  );
}
