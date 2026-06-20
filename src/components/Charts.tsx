"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import type { Task } from "@/lib/types";
import { statusAr } from "@/lib/arabic";

const COLORS = ["#031635", "#006b5f", "#b06d00", "#c14b3a", "#1a2b4b", "#75777f", "#ba1a1a"];

const tooltipStyle = {
  contentStyle: { fontFamily: "var(--font-arabic)", borderRadius: 12, border: "1px solid var(--outline-variant)", fontSize: 12 },
};

export function WeeklyCompletionChart({ tasks }: { tasks: Task[] }) {
  const days = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const data = days.map((d, i) => ({
    day: d,
    منجزة: tasks.filter((t) => t.status === "completed" && new Date(t.completedAt ?? t.updatedAt).getDay() === (i + 6) % 7).length,
    جديدة: Math.max(0, tasks.filter((t) => new Date(t.createdAt).getDay() === (i + 6) % 7).length),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" opacity={0.4} />
        <XAxis dataKey="day" tick={{ fontFamily: "var(--font-arabic)", fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontFamily: "var(--font-arabic)", fontSize: 12 }} />
        <Bar dataKey="منجزة" fill="#006b5f" radius={[6, 6, 0, 0]} />
        <Bar dataKey="جديدة" fill="#1a2b4b" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPie({ tasks }: { tasks: Task[] }) {
  const counts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  const data = Object.entries(counts).map(([k, v]) => ({ name: statusAr[k as Task["status"]], value: v }));
  if (data.length === 0) return <p className="py-10 text-center text-sm text-on-surface-variant">لا توجد بيانات</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={84} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontFamily: "var(--font-arabic)", fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function WorkloadBars({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-on-surface-variant">لا توجد بيانات</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--outline-variant)" opacity={0.4} />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontFamily: "var(--font-arabic)", fontSize: 11 }} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="value" fill="#006b5f" radius={[0, 6, 6, 0]} name="المهام" />
      </BarChart>
    </ResponsiveContainer>
  );
}
