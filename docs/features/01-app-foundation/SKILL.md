---
name: mentalreset-app-foundation
description: >-
  Implement MentalReset app foundation — Vite/React scaffold, app shell navigation,
  theme/layout system, Zustand stores, and session FSM. Use when bootstrapping the
  project, adding global layout, routing, state architecture, or shared UI primitives.
---

# 01 — App Foundation

> Implementation guide for the MentalReset foundation layer.  
> Specs: [product_spec.md](../../specs/product_spec.md) · [tech_stack.md](../../specs/tech_stack.md) · [architecture.md](../../specs/architecture.md) · [ui_wireflow.md](../../specs/ui_wireflow.md) · [schema.md](../../specs/schema.md)

## Metadata

| Field | Value |
|---|---|
| **Feature area** | 01 — App Foundation |
| **Severity** | BLOCKER — nothing else ships without this |
| **Status** | Not started |
| **Estimated effort** | M (2–4 weeks) |
| **Depends on** | — |
| **Unblocks** | 02 Mental Reset session, 03 Task Management, 04 Data & Sync, 05 Settings |

---

## Problem Statement

MentalReset has no runnable application shell. Before any session step, task view, or sync logic can ship, the project needs a consistent scaffold, navigation model, visual system, and state architecture that enforce offline-first and FSM-driven session rules from day one.

Getting the foundation wrong — leaky state mutations, missing offline persistence hooks, or navigation that bypasses the session machine — creates expensive rework across every downstream feature.

---

## Goals

1. **Project scaffold** — Vite + React + TypeScript (strict), Tailwind, ESLint, Prettier, Vitest, RTL.
2. **Two-layer navigation** — App shell (IDLE, Today's Plan, Settings, History) separate from session FSM screens.
3. **Theme & layout** — Mobile-first shell, design tokens, reusable UI primitives aligned with calm/minimal product principles.
4. **State architecture** — Zustand stores + `sessionMachine` as the sole authority for session transitions.
5. **Storage hooks** — Dexie.js stub wired into stores so later features persist without refactoring.

---

## Non-Goals

- Implementing session step UI (Brain Dump, Sorting, etc.) — that is feature 02.
- Firestore sync logic, auth flows, or conflict resolution — feature 04.
- Notifications, analytics, AI, dark mode, i18n — post-MVP.
- Choosing between alternative frameworks (decision: Vite + React, per tech stack).

---

## Scope Breakdown

Foundation work spans four concerns. Ship in this order:

| Phase | Deliverable | Why first |
|---|---|---|
| 1 | Project setup | Unblocks all code |
| 2 | State management + Dexie stub | Navigation and UI depend on stores |
| 3 | Theme & layout | Shared primitives before screens |
| 4 | App navigation | Wire shell + FSM view resolver |

---

## Functional Requirements

- **FR-1.** The app MUST boot with `npm install && npm run dev` on a clean clone.
- **FR-2.** TypeScript strict mode MUST be enabled; no `any` without explicit justification.
- **FR-3.** Firebase SDK MUST initialize from environment variables (`.env.example` committed, `.env` gitignored).
- **FR-4.** Dexie MUST open on startup with tables stubbed for tasks, sessions, sessionSummaries, settings.
- **FR-5.** `sessionMachine` MUST define all states from [architecture.md](../../specs/architecture.md) and reject invalid transitions.
- **FR-6.** UI components MUST NOT call session state setters directly — only through machine actions/hooks.
- **FR-7.** App shell routes MUST be unreachable during an active session unless the user confirms abandonment.
- **FR-8.** Layout MUST be mobile-first with a single primary CTA slot per screen.
- **FR-9.** Touch targets MUST be ≥ 44×44 px.

---

## Recommended Project Structure

```
src/
├── app/                    # Root providers, bootstrap
├── components/
│   └── ui/                 # Button, Card, Input, Screen, PrimaryCTA
├── features/
│   ├── shell/              # IDLE, AppLayout, route guards
│   └── session/            # FSM view resolver (screens added in 02)
├── lib/
│   ├── db/                 # Dexie schema + helpers
│   ├── firebase/           # Firebase init
│   └── sessionMachine/     # FSM definition + transition table
├── stores/
│   ├── sessionStore.ts
│   ├── taskStore.ts        # stub for 03
│   ├── settingsStore.ts    # stub for 05
│   └── syncStore.ts        # stub for 04
├── styles/                 # Tailwind entry, CSS variables / tokens
└── types/                  # SessionState, TaskCategory, shared enums
```

Keep feature folders cohesive. Avoid a flat `components/` dump that mixes session and shell concerns.

---

## 1. Project Setup

### Must configure

- **Vite** — React plugin, path alias `@/` → `src/`
- **Tailwind** — extend theme with spacing, color, motion tokens (not hardcoded hex in components)
- **Framer Motion** — install now; lazy-load animation wrappers if bundle size matters
- **dnd-kit** — install now; no usage until task views need it
- **Vitest + RTL** — one smoke test proving `<App />` renders

### Firebase init pattern

Initialize once in `lib/firebase/`. Guard against missing env vars in dev with a clear console warning, not a silent crash. Do not block offline-only usage if Firebase fails to init — local Dexie must still work.

### Edge cases

| Scenario | Expected behavior |
|---|---|
| Missing `.env` on first clone | App runs offline; sync/auth features noop with dev warning |
| Firebase SDK load failure (ad blocker, network) | App continues; show subtle offline indicator later (04) |
| IndexedDB unavailable (private browsing, quota) | Surface readable error; do not infinite-retry |
| HMR during active dev session | Store rehydration must not corrupt in-progress session state |

### Best practices

- Commit `.env.example` with every required key documented.
- Pin major dependency versions in `package.json`.
- Add `typecheck` script (`tsc --noEmit`) and run it in CI alongside lint/test.
- Do not commit Firebase service account keys — client SDK config only.

---

## 2. State Management

### Stores (Zustand)

| Store | Owns | Persists to Dexie |
|---|---|---|
| `sessionStore` | Active session, thoughts (stub), FSM state | Yes — active session only |
| `taskStore` | Task list (stub empty) | Yes |
| `settingsStore` | User preferences (stub defaults) | Yes |
| `syncStore` | Online status, pending sync flag (stub) | No |

Use selectors (`useSessionStore(s => s.state)`) to limit re-renders. Avoid one mega-store.

### sessionMachine

Model as an explicit transition table, not scattered `if` statements:

```ts
// Pseudocode — implement in lib/sessionMachine/
const transitions: Record<SessionState, Partial<Record<SessionEvent, SessionState>>> = {
  IDLE:           { START: 'BRAIN_DUMP' },
  BRAIN_DUMP:     { CONTINUE: 'SORTING' },
  SORTING:        { CONTINUE: 'PRIORITIZATION' },
  // ... complete per architecture.md
};
```

Export:

- `getValidEvents(state)` — for enabling/disabling CTAs
- `transition(state, event)` — returns next state or throws on invalid
- `useSessionActions()` — hook that wraps store + machine (only public API for UI)

### Edge cases

| Scenario | Expected behavior |
|---|---|
| Double-tap Continue | Idempotent — no double transition; debounce or guard on transitioning flag |
| Invalid transition attempted | Throw in dev; log + ignore in prod; never silently skip states |
| App killed mid-session | Rehydrate from Dexie on next load; resume at last FSM state (full recovery in 04) |
| User hits browser Back | Intercept during session; confirm abandon before leaving |
| Concurrent tab open | Last write wins locally; document as known MVP limitation |
| Empty sessionStore on first visit | Default to `IDLE`; no phantom active session |

### Best practices

- Unit-test every valid and invalid transition in Vitest — this is the highest-value foundation test.
- Never export raw `setState` from session store to UI layers.
- Keep ephemeral thought data in session store, not task store, until promoted to Task in feature 02.
- Persist to Dexie on meaningful transitions (not every keystroke during Brain Dump — debounce writes).

---

## 3. Theme & Layout

### Design tokens

Define in Tailwind config or CSS variables:

- **Colors** — neutral background, calm accent, high-contrast text (WCAG AA)
- **Spacing** — consistent screen padding, card gap
- **Typography** — readable body size on mobile (≥ 16px inputs to prevent iOS zoom)
- **Motion** — default ≤ 300ms; document that Release (feature 02) is the exception

### UI primitives (build now, use everywhere)

| Component | Responsibility |
|---|---|
| `Screen` | Safe-area padding, scroll container, footer CTA slot |
| `PrimaryCTA` | Single full-width action; disabled/loading states |
| `SecondaryButton` | Lower-emphasis actions (Edit, Delete) |
| `Card` | Thought/task surface |
| `Input` | Brain dump and forms; accessible label + focus ring |

### Global UI rules (from product spec)

- One primary decision per screen.
- One primary CTA per screen — if you need two, one is secondary.
- No gamification visuals (badges, streaks, confetti).
- Functional first, calming second — avoid decorative noise.

### Edge cases

| Scenario | Expected behavior |
|---|---|
| Small viewport (320px) | No horizontal scroll; CTA remains reachable without scrolling past content |
| Large desktop | Content centered with max-width; do not stretch cards edge-to-edge |
| Keyboard open on mobile | Input and CTA remain visible; use appropriate `visualViewport` handling if needed |
| Reduced motion preference | Respect `prefers-reduced-motion`; skip non-essential animations |
| Focus trap in modals | Abandon-session confirm dialog must trap focus and restore on close |

### Best practices

- Build `Screen` with a fixed footer CTA pattern from the start — retrofitting is painful.
- Use semantic HTML (`main`, `button`, `nav`) and visible focus rings.
- Do not hardcode session-specific copy in primitives — pass as props/children.
- Reference wireframes in `wireframes/` for visual direction, not for new product rules.

---

## 4. App Navigation

### Two layers (critical)

```
App Shell                    Session FSM (active session only)
─────────                    ─────────────────────────────────
IDLE                         BRAIN_DUMP → … → SUMMARY
Today's Plan
Settings
Session History
```

During an active session (`state !== IDLE && state !== SUMMARY` completion flow), the app shell is blocked. SUMMARY is still part of the session until Finish returns to IDLE.

### View resolver pattern

```tsx
// Pseudocode
function SessionView() {
  const state = useSessionStore(s => s.state);
  const views: Record<SessionState, ReactNode> = {
    IDLE: <IdleScreen />,
    BRAIN_DUMP: <BrainDumpPlaceholder />,  // replaced in 02
    // ...
  };
  return views[state] ?? <Fallback />;
}
```

Shell routes (Today's Plan, Settings) live outside this resolver — gated by a `useSessionGuard()` hook.

### IDLE screen (minimum viable)

- Start Mental Reset → `sessionMachine.transition('START')`
- View Today's Plan → navigate to shell route
- Settings → navigate to shell route (can be stub)

### Abandon session flow

When user tries to leave mid-session:

1. Show confirmation dialog (calm copy — no alarmist language).
2. On confirm: reset session store to IDLE, clear ephemeral session data from Dexie.
3. On cancel: remain in session.

Do not silently discard session data without confirmation.

### Edge cases

| Scenario | Expected behavior |
|---|---|
| Deep link to `/plan` mid-session | Guard redirects or shows confirm-abandon |
| Finish from SUMMARY | Transition to IDLE; persist summary stub (02/04) |
| START pressed while session already active | Should be impossible from IDLE-only UI; guard in machine anyway |
| Navigation during Dexie write | Await pending persist before destructive reset |
| Refresh on SUMMARY | Rehydrate SUMMARY state; do not restart at BRAIN_DUMP |

### Best practices

- Prefer a simple router (React Router) for shell routes + FSM view resolver for session — do not encode FSM states as URL paths in MVP (reduces back-button complexity).
- Centralize guard logic — one hook, not per-screen checks.
- IDLE should feel like home — clear, low-pressure entry to Start or Plan.

---

## Acceptance Criteria

- **AC-1.** *Given* a fresh clone, *when* `npm install && npm run dev && npm test`, *then* all pass without manual setup beyond copying `.env.example`.
- **AC-2.** *Given* IDLE, *when* user starts a session, *then* FSM moves to `BRAIN_DUMP` and shell routes are guarded.
- **AC-3.** *Given* any session state except IDLE, *when* an invalid transition is attempted, *then* the machine rejects it (test coverage required).
- **AC-4.** *Given* mid-session, *when* user attempts to open Today's Plan, *then* abandon confirmation appears.
- **AC-5.** *Given* mobile viewport 375px, *when* any foundation screen renders, *then* no horizontal scroll and primary CTA meets 44px touch target.
- **AC-6.** *Given* Dexie initialized, *when* session state changes, *then* active session persists and survives page reload.

---

## Test Plan

| Layer | What to test |
|---|---|
| **Unit** | `sessionMachine` all transitions; invalid transition throws |
| **Unit** | Store selectors and persist middleware |
| **Component** | `Screen`, `PrimaryCTA` render; focus ring present |
| **Component** | Session guard shows confirm dialog |
| **Integration** | Dexie round-trip for session store rehydration |
| **A11y** | axe on IDLE screen + abandon dialog |

Defer Playwright E2E until feature 02 provides a full session path.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| UI bypasses sessionMachine | High | Lint/export discipline; only expose `useSessionActions` |
| Over-engineering sync early | Medium | Stub `syncStore`; no Firestore writes in foundation |
| Layout rework when session screens land | Medium | Ship `Screen` + CTA pattern before 02 |
| IndexedDB schema churn | Medium | Version Dexie schema from day one; document migration path |
| Bundle bloat from Firebase + Motion | Low | Lazy init Firebase; tree-shake unused Framer features |

---

## Open Questions

1. Exact abandon-session copy — keep calm and non-judgmental.
2. Whether Session History gets a shell route in foundation or waits for 03/04.
3. System font stack vs single web font — decide before polishing theme.

---

## References

- [docs/specs/product_spec.md](../../specs/product_spec.md) — design principles, offline-first
- [docs/specs/tech_stack.md](../../specs/tech_stack.md) — tooling and libraries
- [docs/specs/architecture.md](../../specs/architecture.md) — FSM states, data separation, sync model
- [docs/specs/ui_wireflow.md](../../specs/ui_wireflow.md) — shell screens, global UI rules
- [docs/specs/schema.md](../../specs/schema.md) — enums and Dexie/Firestore entities
- [docs/features/_TEMPLATE.md](../_TEMPLATE.md) — full feature doc template for later areas
