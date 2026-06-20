"use client";

import type { TaskStatus, TaskPriority } from "@/lib/types";
import { statusAr, priorityAr, statusTone, priorityTone, fmtNum } from "@/lib/arabic";
import { cn, initials, avatarColor } from "@/lib/utils";
import {
  CalendarClock, Loader2, Ban, Eye, CheckCircle2, XCircle, AlertTriangle,
  ChevronUp, ChevronsUp, Minus, ShieldCheck,
} from "lucide-react";

const toneClass: Record<string, string> = {
  outline: "bg-surface-container text-on-surface-variant",
  secondary: "bg-secondary/12 text-secondary",
  amber: "bg-amber/12 text-amber",
  coral: "bg-coral/14 text-coral",
  error: "bg-error/12 text-error",
};

const statusIcon: Record<TaskStatus, React.ElementType> = {
  scheduled: CalendarClock,
  in_progress: Loader2,
  blocked: Ban,
  awaiting_review: Eye,
  completed: CheckCircle2,
  cancelled: XCircle,
  overdue: AlertTriangle,
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const Icon = statusIcon[status];
  return (
    <span className={cn("badge", toneClass[statusTone[status]])} aria-label={`الحالة: ${statusAr[status]}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {statusAr[status]}
    </span>
  );
}

const priorityIcon: Record<TaskPriority, React.ElementType> = {
  low: Minus, medium: ChevronUp, high: ChevronsUp, urgent: AlertTriangle,
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const Icon = priorityIcon[priority];
  return (
    <span className={cn("badge", toneClass[priorityTone[priority]])} aria-label={`الأولوية: ${priorityAr[priority]}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {priorityAr[priority]}
    </span>
  );
}

// Required visible Arabic Team Leader badge — never color-only, always text.
export function LeaderBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn("badge bg-primary/10 text-primary border border-primary/20", className)}
      aria-label="قائد الفريق"
      title="قائد الفريق"
    >
      <ShieldCheck className="h-3 w-3" aria-hidden />
      قائد الفريق
    </span>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-mono text-white"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function StatCard({
  label, value, hint, tone = "default", icon: Icon,
}: {
  label: string; value: number | string; hint?: string;
  tone?: "default" | "secondary" | "amber" | "error"; icon?: React.ElementType;
}) {
  const toneText: Record<string, string> = {
    default: "text-on-surface",
    secondary: "text-secondary",
    amber: "text-amber",
    error: "text-error",
  };
  return (
    <div className="card card-pad phoenix-motif">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-on-surface-variant">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", toneText[tone])} aria-hidden />}
      </div>
      <p className={cn("stat-num mt-2", toneText[tone])}>
        {typeof value === "number" ? fmtNum(value) : value}
      </p>
      {hint && <p className="meta mt-1">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function EmptyState({ title, hint, icon: Icon = Eye }: { title: string; hint?: string; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-outline-variant bg-surface-lowest py-12 text-center">
      <Icon className="h-8 w-8 text-on-surface-variant/50" aria-hidden />
      <p className="text-sm font-medium text-on-surface">{title}</p>
      {hint && <p className="text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-on-surface">{children}</h2>
      {action}
    </div>
  );
}

export function ConfirmDialog({
  open, title, message, confirmLabel = "حذف", cancelLabel = "إلغاء", danger = true,
  onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-card bg-surface-container-lowest p-5 shadow-xl animate-fade-in">
        <div className="flex items-start gap-3">
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-card", danger ? "bg-error/10 text-error" : "bg-primary/10 text-primary")}>
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-bold text-on-surface">{title}</h3>
            <p className="meta mt-1 normal-case tracking-normal text-on-surface-variant">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onConfirm} className={danger ? "btn-danger" : "btn-primary"}>{confirmLabel}</button>
          <button onClick={onCancel} className="btn-ghost">{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
