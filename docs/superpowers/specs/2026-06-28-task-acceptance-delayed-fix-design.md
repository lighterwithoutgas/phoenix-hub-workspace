# Task Acceptance Gate + Delayed-Label Fix — Design

Date: 2026-06-28
Status: Approved for planning

## Problem

1. When a leader assigns a task to a member, the member starts work immediately —
   there is no step where the member **confirms/accepts** the assignment.
2. `"overdue"` is stored as a real `TaskStatus`. On every workspace load,
   `markOverdue` rewrites a past-due task's status to `"overdue"`, destroying the
   underlying workflow state (`scheduled` / `in_progress`). Two bugs follow:
   - A delayed task shows **no action buttons** (the detail page only renders
     actions for `scheduled` / `in_progress` / `blocked`), so neither the
     assignee nor a privileged user can confirm or progress it.
   - Granting an extension moves `dueDate` but never clears the stuck
     `"overdue"` status, so an extended task stays labeled delayed even though
     its due date is now in the future ("the day renewed but it's still delayed").

## Core decision

Stop storing `"overdue"`. **Derive "delayed" from `dueDate` at display time.** A task
then carries two independent facts: its real workflow status (e.g. `in_progress`)
and whether it is currently delayed. Moving the due date forward clears the
delayed flag automatically; the real status is never frozen, so actions stay
available.

## Scope decisions

- **Acceptance lifecycle:** both ends. Add accept-on-assignment AND keep the
  existing completion review (`submitForReview → awaiting_review → reviewTask`).
- **Privileged group** (may confirm/act on a delayed task): team leaders of the
  task's team, plus admins and owner — matches existing `canReviewTask` /
  `isElevated`.
- **Decline:** not supported. Accept-only. A leader reassigns manually if needed.
- **Migration:** auto-heal — on workspace load, any task stored with status
  `"overdue"` is rewritten to `"in_progress"` so it re-derives correctly.

## Data model (`src/lib/types.ts`)

- Add `"pending_acceptance"` to `TaskStatus`.
- Remove `"overdue"` from `TaskStatus` (it is no longer a stored state).

## Derived helper

`isDelayed(task: Task): boolean` (placed in `src/lib/selectors.ts`, re-using the
`isOverdue` date check from `utils.ts`):

```
isDelayed(task) =
  task.status ∉ { completed, cancelled, awaiting_review, pending_acceptance }
  && new Date(task.dueDate).getTime() < Date.now()
```

Rationale for exclusions: completed/cancelled are terminal; `awaiting_review`
is in the reviewer's court, not the member's; `pending_acceptance` has not been
started yet.

## Behavior changes (`src/lib/workspace-context.tsx`)

- **Create:** tasks of type `individual`, `multiple_members_shared`, and
  `team_member_copies` are created with status `"pending_acceptance"`.
  `team_shared` is created `"scheduled"` (no single owner to accept).
- **Remove `markOverdue`** entirely. Replace its use at hydrate with a one-time
  **heal** pass: any task whose stored status is `"overdue"` becomes
  `"in_progress"`.
- **New action `acceptTask(taskId)`:** guarded so the caller is the assignee OR
  a privileged user (`canReviewTask` true OR `isElevated`). Transition
  `pending_acceptance → scheduled`. Log `task_accepted`. Notify the task creator.
  No-op if the task is not `pending_acceptance`.
- `updateProgress`'s `scheduled → in_progress` auto-advance is unchanged; it does
  not fire while a task is still `pending_acceptance` (progress controls are
  hidden until accepted — see UI).
- `reviewExtension` and `updateTask` are unchanged in logic; because delayed is
  now derived, moving `dueDate` forward clears the label with no extra code.

## UI

### `src/components/ui.tsx` — `StatusBadge`
Render the real status badge, and **additionally** a separate red "متأخرة" chip
when `isDelayed(task)` is true (badge no longer replaced). Add an icon for
`pending_acceptance`.

### `src/lib/arabic.ts`
- Add label `pending_acceptance: "بانتظار القبول"` and a tone/color entry.
- Keep `"متأخرة"` available as the delayed-chip label.
- Remove the `overdue` status entries (now unused as a status) — the delayed
  chip uses its own constant.

### `src/app/(app)/tasks/[id]/page.tsx`
- New action for `status === "pending_acceptance"`: **"قبول المهمة"** button →
  `acceptTask(task.id)`, shown when the user is the assignee or privileged.
  While pending, hide the start/progress/submit controls.
- Due-date red tone driven by `isDelayed(task)` instead of
  `status === "overdue"`.
- Progress slider / work actions render once status is `scheduled` or later
  (unchanged thresholds), so a delayed-but-active task keeps all its buttons.

### `src/components/TaskList.tsx`
- Delayed indicator uses `isDelayed(task)` (it already computes `isOverdue`;
  switch to the shared helper).
- Status filters: drop `"overdue"`, add `"pending_acceptance"`. (A "delayed"
  cross-status filter is out of scope for this change.)

### Dashboards / stats
Replace every `t.status === "overdue"` with `isDelayed(t)`:
- `src/lib/selectors.ts` — the counts builder (`overdue` count → count of
  `isDelayed`); add `pending_acceptance` to the status tally.
- `src/app/(app)/overview/page.tsx` — three dashboards (admin, leader, member).
- `src/app/(app)/teams/page.tsx` — per-team delayed count.
- `src/app/(app)/analytics/page.tsx` — uses `counts.overdue`; keep the label
  but feed it the derived count.

## Testing

- `isDelayed`: past due + active status → true; future due → false; each
  excluded status (completed, cancelled, awaiting_review, pending_acceptance)
  with a past due date → false.
- `acceptTask`: assignee accepts → `scheduled` + `task_accepted` logged + creator
  notified; privileged user accepts on behalf → same; non-privileged
  non-assignee → no-op; task not `pending_acceptance` → no-op.
- Heal pass: a task stored as `"overdue"` loads as `"in_progress"`.
- Extension regression: a delayed task granted an extension to a future date is
  no longer delayed and retains its real status.

## Files touched

`src/lib/types.ts`, `src/lib/selectors.ts`, `src/lib/utils.ts`,
`src/lib/workspace-context.tsx`, `src/lib/arabic.ts`, `src/components/ui.tsx`,
`src/components/TaskList.tsx`, `src/app/(app)/tasks/[id]/page.tsx`,
`src/app/(app)/overview/page.tsx`, `src/app/(app)/teams/page.tsx`,
`src/app/(app)/analytics/page.tsx`, plus tests under `tests/`.

## Out of scope

- Decline/reassignment flow.
- Per-member acceptance tracking for shared tasks (first acceptance activates).
- A dedicated "delayed" cross-status filter chip in the task list.
