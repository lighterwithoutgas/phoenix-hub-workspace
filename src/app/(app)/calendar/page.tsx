"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, CalendarDays } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { tasksFor } from "@/lib/selectors";
import { statusTone, statusAr } from "@/lib/arabic";
import { EmptyState } from "@/components/ui";
import type { Task } from "@/lib/types";

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const arNum = new Intl.NumberFormat("ar-EG");

const dotColor: Record<string, string> = {
  secondary: "bg-secondary", amber: "bg-amber", coral: "bg-coral", error: "bg-error", outline: "bg-outline-variant",
};

export default function CalendarPage() {
  const { currentUser, data } = useWorkspace();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState<string | null>(null);

  const tasks = useMemo(() => (currentUser ? tasksFor(data, currentUser) : []), [data, currentUser]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const key = new Date(t.dueDate).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayKey = new Date().toISOString().slice(0, 10);

  const selectedTasks = selected ? byDay.get(selected) ?? [] : [];

  if (!currentUser) return null;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">التقويم</h1>
          <p className="meta mt-1">المواعيد النهائية للمهام</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="btn-ghost p-2" aria-label="الشهر السابق"><ChevronRight className="h-5 w-5" /></button>
          <span className="min-w-32 text-center font-bold text-on-surface">{MONTHS[month]} {arNum.format(year)}</span>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="btn-ghost p-2" aria-label="الشهر التالي"><ChevronLeft className="h-5 w-5" /></button>
        </div>
      </header>

      <div className="card card-pad">
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => <div key={d} className="py-2 text-xs font-medium text-on-surface-variant">{d}</div>)}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} />;
            const key = new Date(year, month, day).toISOString().slice(0, 10);
            const dayTasks = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSel = key === selected;
            return (
              <button key={key} onClick={() => setSelected(key)}
                className={`min-h-16 rounded-lg border p-1 text-right transition ${isSel ? "border-primary bg-primary/5" : isToday ? "border-secondary/50" : "border-outline-variant/40 hover:border-primary/30"}`}>
                <span className={`text-xs ${isToday ? "font-bold text-secondary" : "text-on-surface"}`}>{arNum.format(day)}</span>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {dayTasks.slice(0, 4).map((t) => <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${dotColor[statusTone[t.status]] ?? "bg-outline-variant"}`} title={t.title} />)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="card card-pad">
          <h3 className="font-bold text-on-surface">مهام {new Date(selected).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}</h3>
          {selectedTasks.length ? (
            <div className="mt-2 space-y-1">
              {selectedTasks.map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-surface-container-low">
                  <span className="truncate text-sm text-on-surface">{t.title}</span>
                  <span className="meta">{statusAr[t.status]}</span>
                </Link>
              ))}
            </div>
          ) : <EmptyState title="لا مهام في هذا اليوم" icon={CalendarDays} />}
        </div>
      )}
    </div>
  );
}
