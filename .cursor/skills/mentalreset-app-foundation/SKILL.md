---
name: mentalreset-app-foundation
description: >-
  Implement MentalReset app foundation — Vite/React scaffold, app shell navigation,
  theme/layout system, Zustand stores, session FSM, and Playwright E2E tests. Use when
  bootstrapping the project, adding global layout, routing, state architecture,
  shared UI primitives, or foundation end-to-end test specs.
---

# MentalReset — App Foundation (Skill)

## Canonical guide

**Read the full implementation guide before writing code:**

`docs/features/01-app-foundation/SKILL.md`

Use the Read tool to load that file completely. It is the single source of truth — edit only the docs copy, not this wrapper.

Supporting specs (read when relevant):

- `docs/specs/product_spec.md`
- `docs/specs/tech_stack.md`
- `docs/specs/architecture.md`
- `docs/specs/ui_wireflow.md`
- `docs/specs/schema.md`

## When to apply

- Bootstrapping the repo (phase 1)
- Zustand stores, `sessionMachine`, Dexie stub (phase 2)
- Theme, layout, UI primitives (phase 3)
- App shell navigation and session guards (phase 4)
- Playwright E2E harness and foundation specs (phase 5)

## Non-negotiable constraints

- **Offline-first** — IndexedDB (Dexie) is runtime source of truth; Firebase is sync only.
- **Session FSM** — UI = f(sessionState); transitions only via `sessionMachine`, never direct store mutation from components.
- **Two navigation layers** — App shell (IDLE, Today's Plan, Settings) vs session screens; guard shell during active session.
- **Mobile-first** — One primary CTA per screen; touch targets ≥ 44px; calm/minimal UI (no gamification).
- **Phased delivery** — Follow phases 1→5 in the guide; defer session step UI (02), sync/auth (04), settings (05).
- **Testing** — Vitest + RTL for units/components; Playwright for foundation E2E per section 5 of the guide.

## How to work

1. Read `docs/features/01-app-foundation/SKILL.md` in full.
2. Implement the requested phase only.
3. Stop when the phase's acceptance criteria pass (`npm test`, `npm run test:e2e` as applicable).
