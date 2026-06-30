---
name: mentalreset-task-management
description: >-
  Implement task management outside the session — Today's Plan, complete tasks,
  Save for Later management, and session history review. Use when building task
  lists, category moves, completion toggles, or task-view E2E tests.
---

# 03 — Task Management

Implementation guide for app-shell task views (outside the session FSM).  
Specs: [product_spec.md](../../specs/product_spec.md) · [ui_wireflow.md](../../specs/ui_wireflow.md) · [schema.md](../../specs/schema.md) · [architecture.md](../../specs/architecture.md)

**Depends on:** 01 App Foundation, 02 Mental Reset (tasks created in session)  
**Unblocks:** — (enhances daily planning use case)

---

## Goals

1. **Today's Plan** — view tasks by attention level; simple, non-PM UI
2. **Complete tasks** — check off; retain completed state locally
3. **Manage Save for Later** — view and move `LATER` tasks; never auto-surface
4. **Session history** — read-only list of SessionSummary records

## Non-Goals

- Due dates, projects, tags, assignments — MVP excludes these
- Editing task text in Today's Plan (unless explicitly added — default: no inline edit in MVP)
- Recovering released thoughts
- Drag-and-drop reorder (optional; dnd-kit only if needed for category move)

---

## Phases (ship in order)

| Phase | Deliverable |
|---|---|
| 1 | Today's Plan layout + category groups |
| 2 | Complete / uncomplete tasks |
| 3 | Move tasks between TODAY / SOON / LATER |
| 4 | Session History screen |
| 5 | Task management E2E |

---

## Code layout

```
src/features/tasks/
├── screens/
│   ├── TodaysPlanScreen.tsx
│   └── SessionHistoryScreen.tsx
├── components/
│   ├── TaskList.tsx
│   ├── TaskRow.tsx
│   └── CategorySection.tsx
└── hooks/
    └── useTasksByCategory.ts

src/stores/taskStore.ts          # full implementation (stub from 01)
```

Category labels in UI use product names; store uses `TODAY` | `SOON` | `LATER` ([schema.md](../../specs/schema.md)).

---

## 1. Today's Plan

Grouped sections:

- Needs Attention Today (`TODAY`)
- Important if Time Allows (`SOON`)
- Save for Later (`LATER`)
- Completed (optional collapsed section)

Show `estimatedMinutes` for TODAY/SOON when set. No due dates.

Accessible from IDLE shell route. Blocked during active session (guard from 01).

| Edge case | Behavior |
|---|---|
| Empty category | Show calm empty state — not an error |
| All tasks completed | Encourage start session or show completion state |
| Many tasks | Simple scroll list — no pagination in MVP |

---

## 2. Complete tasks

Toggle `completed` on task. Write to Dexie immediately (local-first).

Completed tasks: hide from active sections or show in Completed group — **default: move to Completed section**.

| Edge case | Behavior |
|---|---|
| Uncomplete | Return to previous category (store `category` unchanged) |
| Complete LATER task | Stays completed; still in LATER unless user moves |
| Sync pending (04) | Local write succeeds regardless of online state |

---

## 3. Manage Save for Later

`LATER` section is intentionally separate from active priorities.

Actions: move to TODAY or SOON; move from TODAY/SOON to LATER.

**Never** auto-promote LATER tasks — only user action or opt-in at session start (02).

Optional: dnd-kit for drag between sections; buttons are sufficient for MVP.

| Edge case | Behavior |
|---|---|
| Move to LATER | Clear `estimatedMinutes` if policy is LATER = unscheduled |
| Delete task | Out of MVP unless product adds — default: no delete in MVP, only complete |

---

## 4. Session history

Read-only list from `SessionSummary` store / Dexie table.

Show: date, tasks created, released count, estimated time total. No drill-down into thoughts.

| Edge case | Behavior |
|---|---|
| No history | Empty state with brief explanation |
| Many sessions | Newest first; simple scroll |

---

## 5. End-to-end testing

Add `e2e/specs/task-management.spec.ts`.

| Scenario | Asserts |
|---|---|
| Today's Plan from IDLE | Three category sections render |
| Complete task | Moves to completed; persists after reload |
| Move category | Task appears in new section; Dexie updated |
| LATER not auto-shown in session | Cross-spec with 02 or seed + start session |
| Session history | Shows summary after completed session; read-only |

Seed tasks via Dexie fixture. Run from IDLE — not during active session.

| Edge case | Behavior |
|---|---|
| Navigate to Plan mid-session | Guard from 01 still applies |

---

## Acceptance criteria

- **AC-1.** Today's Plan shows tasks grouped by TODAY / SOON / LATER
- **AC-2.** Completing a task persists across reload
- **AC-3.** User can move tasks between categories
- **AC-4.** LATER tasks never appear in session without explicit opt-in (02)
- **AC-5.** Session History shows summary stats only — no released content
- **AC-6.** UI remains simple — no due dates, projects, or PM patterns
- **AC-7.** `task-management.spec.ts` passes in CI

---

## Risks

| Risk | Mitigation |
|---|---|
| Today's Plan feels like generic todo app | Strict UI simplicity; follow wireflow |
| Task store out of sync with session | Session promotes tasks once at prioritization |
| Completed task clutter | Collapsed Completed section |

## Open questions

1. Allow task deletion in MVP?
2. Show estimated time totals on Today's Plan?
3. Inline edit task text outside session?
