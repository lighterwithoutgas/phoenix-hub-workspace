"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { tasksFor, teamTasks } from "@/lib/selectors";
import { TaskList } from "@/components/TaskList";

export default function TeamTasksPage() {
  const { currentUser, data } = useWorkspace();
  const team = useMemo(
    () => (currentUser ? teamTasks(tasksFor(data, currentUser)) : []),
    [data, currentUser]
  );
  if (!currentUser) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">مهام الفرق</h1>
        <p className="meta mt-1">المهام المشتركة المُسندة إلى الفرق — الفريق هو المسؤول الرسمي</p>
      </header>
      <TaskList tasks={team} data={data} />
    </div>
  );
}
