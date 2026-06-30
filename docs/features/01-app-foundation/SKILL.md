---
name: mentalreset-app-foundation
description: >-
  Implement MentalReset app foundation — Vite/React scaffold, app shell navigation,
  theme/layout system, Zustand stores, session FSM, and Playwright E2E tests. Use when
  bootstrapping the project, adding global layout, routing, state architecture,
  shared UI primitives, or foundation end-to-end test specs.
---

# 01 — App Foundation

Implementation guide for the foundation layer.  
Specs: [product_spec.md](../../specs/product_spec.md) · [tech_stack.md](../../specs/tech_stack.md) · [architecture.md](../../specs/architecture.md) · [ui_wireflow.md](../../specs/ui_wireflow.md) · [schema.md](../../specs/schema.md)

**Unblocks:** 02 Mental Reset session · 03 Task Management · 04 Data & Sync · 05 Settings

---

## Goals

1. **Project scaffold** — Vite, React, TypeScript (strict), Tailwind, ESLint, Prettier, Vitest, RTL, Playwright
2. **State + storage** — Zustand stores, `sessionMachine`, Dexie stub wired to stores
3. **Theme & layout** — Mobile-first shell, design tokens, shared UI primitives
4. **Navigation** — App shell separate from session FSM; guards during active session
5. **E2E harness** — Playwright foundation specs in CI

## Non-Goals

- Session step UI (Brain Dump → Summary) — feature 02
- Firestore sync, auth, conflict resolution — feature 04
- Notifications, analytics, AI, dark mode, i18n — post-MVP

---

## Phases (ship in order)

| Phase | Deliverable |
|---|---|
| 1 | Project setup |
| 2 | State management + Dexie stub |
| 3 | Theme & layout |
| 4 | App navigation |
| 5 | E2E test harness |

---

## Project structure

```
src/
├── app/
├── components/ui/          # Screen, PrimaryCTA, Card, Input, …
├── features/shell/         # IDLE, guards, shell routes
├── features/session/       # FSM view resolver (screens in 02)
├── lib/db/                 # Dexie
├── lib/firebase/           # Firebase init
├── lib/sessionMachine/
├── stores/                 # session, task, settings, sync (stubs where noted)
├── styles/
└── types/

e2e/
├── fixtures/               # IndexedDB reset, helpers
├── pages/                  # Page objects
└── specs/                  # app-boot, navigation, session-persistence
```

---

## 1. Project setup

Configure: Vite (`@/` alias), Tailwind theme tokens, Framer Motion, dnd-kit (install only), Vitest + RTL smoke test, Playwright (`webServer` → `npm run dev`).

Firebase: init once in `lib/firebase/` from env vars. Missing config or SDK failure must not block offline usage — Dexie still works. Commit `.env.example`; never commit secrets.

Scripts: `typecheck`, `test`, `test:e2e` — all run in CI.

| Edge case | Behavior |
|---|---|
| IndexedDB unavailable | Readable error; no infinite retry |
| HMR during dev | Rehydration must not corrupt session state |

---

## 2. State management

### Stores

| Store | Persists to Dexie |
|---|---|
| `sessionStore` — FSM state, thoughts stub | Yes (active session) |
| `taskStore`, `settingsStore` | Yes (stubs) |
| `syncStore` | No |

Use selectors to limit re-renders. Persist on meaningful transitions (debounce Brain Dump writes).

### sessionMachine

Explicit transition table per [architecture.md](../../specs/architecture.md). Export `getValidEvents`, `transition`, and `useSessionActions()` — the **only** UI API for session changes. Never export raw `setState` to components.

Unit-test all valid and invalid transitions in Vitest.

| Edge case | Behavior |
|---|---|
| Double-tap Continue | Guard with transitioning flag |
| Invalid transition | Throw in dev; never silently skip states |
| Mid-session reload | Rehydrate from Dexie at last FSM state |
| Browser Back | Confirm abandon before leaving |
| Concurrent tabs | Last write wins (MVP limitation) |

---

## 3. Theme & layout

Define tokens in Tailwind/CSS: colors (WCAG AA), spacing, typography (inputs ≥ 16px), motion (≤ 300ms; Release in 02 is the exception).

Build primitives: `Screen` (footer CTA slot), `PrimaryCTA`, `SecondaryButton`, `Card`, `Input`.

UI rules: see [ui_wireflow.md](../../specs/ui_wireflow.md) — one primary CTA per screen, no gamification, calm/minimal.

| Edge case | Behavior |
|---|---|
| 320px viewport | No horizontal scroll; CTA reachable |
| `prefers-reduced-motion` | Skip non-essential animation |
| Abandon dialog | Focus trap + restore on close |

---

## 4. App navigation

Two layers — see [architecture.md](../../specs/architecture.md):

```
App shell (IDLE, Today's Plan, Settings, History)
Session FSM (BRAIN_DUMP → … → SUMMARY)
```

During active session, shell is blocked until Finish or confirmed abandon. FSM states are **not** URL paths in MVP — use a view resolver for session, React Router for shell.

IDLE actions: Start Mental Reset (`START` → `BRAIN_DUMP`), Today's Plan, Settings (stub ok).

Abandon flow: confirm dialog → on confirm reset to IDLE and clear ephemeral Dexie session data. Never discard silently.

Centralize guards in one hook (`useSessionGuard`), not per-screen.

| Edge case | Behavior |
|---|---|
| Deep link to `/plan` mid-session | Guard or confirm-abandon |
| Dexie write in flight on abandon | Await persist before reset |
| Reload on SUMMARY | Rehydrate SUMMARY, not BRAIN_DUMP |

---

## 5. End-to-end testing

Scope: shell + FSM entry/exit only. Full session flows extend in feature 02.

**Config essentials:** `testDir: ./e2e/specs`, `webServer` for dev server, mobile + desktop projects, `trace: 'on-first-retry'` in CI.

**Selectors:** `getByRole` first; `data-testid` only when needed. Primary CTAs need accessible names.

**Specs to write:**

| File | Covers |
|---|---|
| `app-boot.spec.ts` | IDLE renders; mobile viewport ok |
| `navigation.spec.ts` | Shell routes; start session; abandon confirm/cancel |
| `session-persistence.spec.ts` | Reload keeps session; abandon clears IndexedDB |

Reset IndexedDB in `beforeEach` (`indexedDB.deleteDatabase('mentalreset')`) except persistence specs. Block Firebase in `page.route` for offline stability. Use page objects in `e2e/pages/`. Do not mock Dexie.

| Edge case | Behavior |
|---|---|
| Dialog timing | `expect(…).toBeVisible()` — no fixed sleeps |
| Parallel workers | Isolated context + storage reset each test |

---

## Acceptance criteria

- **AC-1.** Fresh clone: `npm install && npm run dev && npm test` pass (`.env.example` only setup)
- **AC-2.** IDLE → Start session → `BRAIN_DUMP`; shell guarded mid-session
- **AC-3.** Invalid FSM transitions rejected (unit tests)
- **AC-4.** Mid-session → Today's Plan shows abandon confirmation
- **AC-5.** 375px viewport: no horizontal scroll; CTA ≥ 44px
- **AC-6.** Session state survives `page.reload()`
- **AC-7.** `npm run test:e2e` passes headless in CI
- **AC-8.** Cancel abandon keeps current session state

---

## Risks

| Risk | Mitigation |
|---|---|
| UI bypasses sessionMachine | Only expose `useSessionActions()` |
| Sync over-engineered early | Stub `syncStore`; no Firestore in foundation |
| Flaky E2E | Reset IndexedDB in `beforeEach` |
| Dexie schema churn | Version schema from day one |

## Open questions

1. Abandon-session copy (calm, non-judgmental)
2. Session History route in foundation vs 03/04
3. System fonts vs web font
