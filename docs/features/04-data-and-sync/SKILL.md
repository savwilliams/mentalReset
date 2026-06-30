---
name: mentalreset-data-and-sync
description: >-
  Implement MentalReset data layer — Dexie persistence, Firestore background sync,
  Firebase auth (anonymous + optional account), and mid-session recovery. Use when
  wiring offline-first storage, sync queues, auth, or recovery flows.
---

# 04 — Data & Sync

Implementation guide for local persistence, cloud sync, auth, and session recovery.  
Specs: [architecture.md](../../specs/architecture.md) · [schema.md](../../specs/schema.md) · [tech_stack.md](../../specs/tech_stack.md) · [product_spec.md](../../specs/product_spec.md)

**Depends on:** 01 App Foundation, 02 Mental Reset (data to persist), 03 Task Management (task reads/writes)  
**Unblocks:** 05 Settings (account-linked prefs), cross-device use

---

## Goals

1. **Local storage** — Dexie schema, migrations, Zustand persist middleware
2. **Firebase sync** — background Firestore sync for Task, SessionSummary, UserSettings
3. **Authentication** — anonymous by default; optional account upgrade
4. **Session recovery** — resume active session after reload or crash

## Non-Goals

- Real-time multiplayer sync
- Conflict UI for users — MVP is last-write-wins
- Syncing ephemeral thoughts to Firestore
- FCM / push notifications — feature 05 / post-MVP

---

## Phases (ship in order)

| Phase | Deliverable |
|---|---|
| 1 | Dexie schema + versioned migrations |
| 2 | Store ↔ Dexie persist middleware |
| 3 | Anonymous Firebase auth on first launch |
| 4 | Firestore sync layer (tasks, summaries, settings) |
| 5 | Optional account linking |
| 6 | Session recovery hardening |
| 7 | Sync + recovery E2E |

---

## Code layout

```
src/lib/db/
├── database.ts              # Dexie instance + schema versions
├── migrations/
└── repositories/            # tasks, sessions, summaries, settings

src/lib/sync/
├── syncEngine.ts            # queue, flush, online listener
├── firestoreMappers.ts      # local ↔ cloud document shapes
└── conflict.ts              # last-write-wins helper

src/lib/firebase/
├── auth.ts
└── firestore.ts

src/stores/syncStore.ts      # online, pending, lastSyncAt, error
```

Storage mapping: [schema.md](../../specs/schema.md). Thoughts and active sessions stay local-only.

---

## 1. Local storage

Dexie tables: `tasks`, `sessions` (active), `sessionSummaries`, `settings`.

Version schema from day one (`db.version(n).stores({...}).upgrade()`). Bump version on shape changes.

| Entity | IndexedDB | Notes |
|---|---|---|
| Task | Yes | Source of truth at runtime |
| Thought | Yes (session) | Not synced |
| Active session | Yes | Not synced until complete |
| SessionSummary | Yes | Synced after completion |
| UserSettings | Yes | Synced |

| Edge case | Behavior |
|---|---|
| Migration failure | Block app with recovery message; don't corrupt data |
| Quota exceeded | User-visible error; suggest clearing completed tasks |
| Private browsing | Graceful degradation per 01 |

---

## 2. Firebase sync

**Local-first:** every user action writes Dexie first, then enqueue sync job.

When online: flush queue to Firestore. Firebase is backup + cross-device — not read-before-write on app open.

`syncStore`: `isOnline`, `pendingCount`, `lastSyncAt`, `lastError` (subtle UI optional).

| Collection (conceptual) | Document key | Fields from schema |
|---|---|---|
| `users/{uid}/tasks` | task.id | Task |
| `users/{uid}/summaries` | summary.id | SessionSummary |
| `users/{uid}/settings` | `settings` | UserSettings |

Conflict: **last-write-wins** on `updatedAt` ([architecture.md](../../specs/architecture.md)).

| Edge case | Behavior |
|---|---|
| Offline write | Queue; flush when online |
| Sync fails mid-batch | Retry with backoff; don't roll back local |
| Firebase blocked | App fully usable offline |
| Clock skew | Use server timestamp on write when possible |

---

## 3. User authentication

On first launch: **sign in anonymously**. UID scopes Firestore paths.

Optional: link email/password or OAuth later — preserve local data on upgrade (`linkWithCredential`).

| Edge case | Behavior |
|---|---|
| Anonymous user clears site data | Local loss — expected; cloud backup if synced before |
| Account link failure | Keep anonymous session; show calm error |
| Auth token expiry | Silent refresh; queue sync until restored |

---

## 4. Session recovery

On app load: if Dexie has active session with `state !== IDLE` and not abandoned, rehydrate `sessionStore` and resume FSM screen.

Await in-flight Dexie write before abandon reset (from 01).

| Edge case | Behavior |
|---|---|
| Corrupt session blob | Reset to IDLE; log error |
| Session stuck on SUMMARY | Rehydrate Summary — user can Finish |
| Completed session in Dexie | Clear active session table; keep summary |

---

## 5. End-to-end testing

Add `e2e/specs/sync-recovery.spec.ts`. Use Firebase emulator when possible; otherwise block live Firebase and test local-only paths.

| Scenario | Asserts |
|---|---|
| Offline task complete | Persists in Dexie; sync queue pending |
| Mid-session reload | Resumes correct FSM state |
| Finish session | Active session cleared; summary remains |
| Online flush (emulator) | Task appears in Firestore |

| Edge case | Behavior |
|---|---|
| Emulator not in CI | Skip Firestore assertions; test local + recovery only |

Unit-test: sync queue, mappers, migration upgrades, conflict resolver.

---

## Acceptance criteria

- **AC-1.** All user writes land in Dexie before UI confirms
- **AC-2.** App fully functional with Firebase unreachable
- **AC-3.** Anonymous auth on first launch; UID available for sync
- **AC-4.** Tasks and summaries sync to Firestore when online
- **AC-5.** Thoughts never appear in Firestore
- **AC-6.** Active session survives reload at correct FSM state
- **AC-7.** Schema migration v1→v2 runs without data loss (test)
- **AC-8.** `sync-recovery.spec.ts` passes (local paths minimum)

---

## Risks

| Risk | Mitigation |
|---|---|
| Sync race with UI | Local-first; single sync engine |
| Anonymous data loss | Encourage account link in 05; cloud backup |
| Migration bugs | Versioned Dexie + integration tests |
| Over-syncing | Debounce batch writes; sync on idle |

## Open questions

1. Firebase emulator in CI vs skipped Firestore E2E?
2. When to prompt anonymous → account upgrade?
3. Retention policy for completed tasks in Dexie
