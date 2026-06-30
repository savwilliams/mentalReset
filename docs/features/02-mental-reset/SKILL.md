---
name: mentalreset-mental-reset-session
description: >-
  Implement the Mental Reset session workflow — start session, brain dump, sorting,
  prioritization, time estimation, release, and summary screens. Use when building
  session FSM screens, thought handling, task promotion, or session-flow E2E tests.
---

# 02 — Mental Reset Session

Implementation guide for the linear session workflow (Brain Dump → Summary).  
Specs: [product_spec.md](../../specs/product_spec.md) · [architecture.md](../../specs/architecture.md) · [ui_wireflow.md](../../specs/ui_wireflow.md) · [schema.md](../../specs/schema.md)

**Depends on:** 01 App Foundation  
**Unblocks:** 03 Task Management (tasks created here), 04 Data & Sync (session completion writes)

---

## Goals

1. **Start session** — optional Save for Later review; transition to Brain Dump
2. **Brain Dump** — add, edit, delete unstructured thoughts
3. **Sorting** — resolve each thought: actionable or release (no "maybe")
4. **Prioritization** — assign TODAY / SOON / LATER / CAN_DO_WITHOUT per thought
5. **Time estimation** — estimate TODAY + SOON tasks only
6. **Release** — emotional letting-go moment; discard release-queue items permanently
7. **Summary** — closure stats; persist SessionSummary; return to IDLE

## Non-Goals

- Today's Plan UI — feature 03
- Firestore sync — feature 04
- Voice input, AI suggestions — post-MVP
- Reopening or recovering released thoughts

---

## Phases (ship in order)

| Phase | Deliverable |
|---|---|
| 1 | Start session + Save for Later pull-in |
| 2 | Brain Dump screen |
| 3 | Sorting screen |
| 4 | Prioritization screen |
| 5 | Time estimation screen |
| 6 | Release screen |
| 7 | Summary + session completion |
| 8 | Session-flow E2E |

---

## Code layout

```
src/features/session/
├── screens/
│   ├── StartSessionScreen.tsx      # optional LATER review
│   ├── BrainDumpScreen.tsx
│   ├── SortingScreen.tsx
│   ├── PrioritizationScreen.tsx
│   ├── TimeEstimationScreen.tsx
│   ├── ReleaseScreen.tsx
│   └── SummaryScreen.tsx
├── components/                     # ThoughtCard, CategoryPicker, TimePreset, …
└── hooks/                          # useThoughtQueue, useReleaseQueue, …

e2e/specs/session-flow.spec.ts
e2e/pages/                          # extend foundation page objects
```

Wire each screen into the FSM view resolver from 01. Transitions only via `useSessionActions()`.

---

## 1. Start session

From IDLE: optional step to review `LATER` tasks and pull selected items into session (`source: SAVE_FOR_LATER`). User must opt in — never auto-import.

Then `START` → `BRAIN_DUMP`. Skip review if no LATER tasks exist.

| Edge case | Behavior |
|---|---|
| User skips review | Proceed directly to Brain Dump |
| Pulled LATER task | Enters session context; still needs sorting if added as thought, or pre-seeded as task candidate per product decision |
| Empty LATER list | Hide or skip review step |

---

## 2. Brain Dump

UI per [ui_wireflow.md](../../specs/ui_wireflow.md): input + thought cards. Actions: add, edit, delete.

Continue enabled when ≥ 1 thought exists (or allow empty? — **default: require ≥ 1** to avoid empty sessions).

Debounce Dexie writes on text edits. Thoughts are session-only ([schema.md](../../specs/schema.md)).

| Edge case | Behavior |
|---|---|
| Empty thought text | Block add |
| Very long text | Reasonable max length (e.g. 500 chars) with soft warning |
| Delete last thought | Continue disabled |
| Edit during later phases | Not allowed — Brain Dump is complete after CONTINUE |

---

## 3. Sorting

One thought at a time. Actions: **I can act on this** (`resolvedAs: TASK`) / **I cannot act on this** (`resolvedAs: RELEASE`).

Continue only when all thoughts resolved. Release-queue items go to Release phase — not Task store.

| Edge case | Behavior |
|---|---|
| Single thought | Same UI — no batch shortcuts |
| User navigates back | Not in MVP — forward-only within session |
| Pulled LATER tasks | Include in sort queue if modeled as thoughts |

---

## 4. Prioritization

One actionable item at a time. Options map to [schema.md](../../specs/schema.md):

| UI label | Result |
|---|---|
| Needs Attention Today | `TODAY` → Task record |
| Important if Time Allows | `SOON` → Task record |
| Save for Later | `LATER` → Task record |
| Can Do Without | `CAN_DO_WITHOUT` → release queue, **no Task** |

Promote to `taskStore` + Dexie for TODAY/SOON/LATER. Increment `session.stats.tasksCreated`.

| Edge case | Behavior |
|---|---|
| Zero actionable thoughts | Skip to Time Estimation or Release per FSM — define empty path in machine |
| Duplicate task text | Allow — user may mean distinct items |

---

## 5. Time estimation

Scope: tasks with `TODAY` or `SOON` only. Presets (5, 15, 30, 60 min) + custom input.

Save `estimatedMinutes` on task. Update `session.stats.estimatedTimeTotal`.

| Edge case | Behavior |
|---|---|
| No TODAY/SOON tasks | Skip screen — auto-CONTINUE in machine |
| Custom time | Validate positive integer; reasonable max (e.g. 480) |
| LATER tasks | Never shown here |

---

## 6. Release

Two lists per [ui_wireflow.md](../../specs/ui_wireflow.md):

- **Release list** — `resolvedAs: RELEASE` from Sorting
- **Can Do Without** — from Prioritization

**Release All** permanently discards content. Framer Motion fade/dissolve allowed > 300ms. Calm copy — no gamification.

Respect `prefers-reduced-motion`. Update `session.stats.releasedCount`.

| Edge case | Behavior |
|---|---|
| Both lists empty | Skip or show affirming empty state — still allow CONTINUE |
| User expects undo | No undo — released content is gone (product rule) |
| Animation interrupted | Content still discarded on confirm |

---

## 7. Summary

Show: tasks created, total estimated time, items released. **Finish session** → write `SessionSummary`, clear ephemeral session data, `IDLE`.

Do not expose released thought text in history.

| Edge case | Behavior |
|---|---|
| Reload on Summary | Rehydrate Summary screen (from 01) |
| Finish | Atomic: summary write + session clear + FSM to IDLE |

---

## 8. End-to-end testing

Extend foundation Playwright setup. Add `e2e/specs/session-flow.spec.ts`.

| Scenario | Asserts |
|---|---|
| Happy path | IDLE → full session → Summary → IDLE |
| Brain Dump | Add/edit/delete thoughts; Continue gated |
| Sorting | Every thought resolved before Continue |
| CAN_DO_WITHOUT | Not in task list after session; in release count |
| Release | Items not recoverable after Finish |
| Save for Later pull-in | Opt-in only; never auto-added |

Use page objects per screen. Seed LATER tasks via Dexie helper in fixtures. Full path may use `test.step()` for readability.

| Edge case | Behavior |
|---|---|
| Long Release animation | `expect` on UI state, not fixed timeout |
| Session data after Finish | No thoughts in store; SessionSummary exists |

---

## Acceptance criteria

- **AC-1.** User completes full session IDLE → Summary → IDLE without invalid FSM transitions
- **AC-2.** Every thought ends as Task (TODAY/SOON/LATER) or permanently released
- **AC-3.** CAN_DO_WITHOUT never creates a Task record
- **AC-4.** Time estimation applies only to TODAY + SOON tasks
- **AC-5.** Save for Later tasks never auto-appear at session start
- **AC-6.** SessionSummary persisted on Finish; released text not recoverable
- **AC-7.** `session-flow.spec.ts` passes in CI
- **AC-8.** Release respects reduced-motion preference

---

## Risks

| Risk | Mitigation |
|---|---|
| Session logic leaks into UI | Screen components call hooks/actions only |
| Thought/task state duplication | Single session store; promote to taskStore at prioritization |
| Release UX too heavy | User-test copy; subtle animation only |
| Empty-session edge paths | Explicit FSM branches + unit tests |

## Open questions

1. Pulled LATER items: enter as pre-sorted tasks or as thoughts?
2. Minimum thoughts required to start Sorting?
3. Release empty-state copy
