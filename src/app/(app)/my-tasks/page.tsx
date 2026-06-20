"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { tasksFor, myTasks } from "@/lib/selectors";
import { TaskList } from "@/components/TaskList";

export default function MyTasksPage() {
  const { currentUser, data } = useWorkspace();
  const mine = useMemo(() => (currentUser ? myTasks(tasksFor(data, currentUser), currentUser.id) : []), [data, currentUser]);
  if (!currentUser) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">مهامي</h1>
        <p className="meta mt-1">المهام المسندة إليك مباشرة أو التي أنت مسؤول عنها</p>
      </header>
      <TaskList tasks={mine} data={data} />
    </div>
  );
}
