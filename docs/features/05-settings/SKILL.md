---
name: mentalreset-settings
description: >-
  Implement MentalReset settings — notifications preferences, account settings,
  and app preferences. Use when building the Settings screen, auth upgrade UI,
  or user preference persistence.
---

# 05 — Settings

Implementation guide for the Settings app-shell area.  
Specs: [product_spec.md](../../specs/product_spec.md) · [schema.md](../../specs/schema.md) · [tech_stack.md](../../specs/tech_stack.md) · [architecture.md](../../specs/architecture.md)

**Depends on:** 01 App Foundation, 04 Data & Sync (auth + settings persist/sync)  
**Unblocks:** — (polish and account retention)

---

## Goals

1. **App preferences** — minimal toggles stored in UserSettings
2. **Account settings** — anonymous state visibility; optional account creation/linking
3. **Notifications** — preference UI + stub for future FCM (not active in MVP)

## Non-Goals

- Custom themes in MVP — schema reserves `theme`; ship later
- Full notification delivery (FCM) — post-MVP per [tech_stack.md](../../specs/tech_stack.md)
- Profile photos, social, sharing
- In-settings task or session management

---

## Phases (ship in order)

| Phase | Deliverable |
|---|---|
| 1 | Settings screen shell + navigation from IDLE |
| 2 | App preferences (persist to settingsStore + Dexie) |
| 3 | Account section (anonymous + link account) |
| 4 | Notifications toggle (disabled / coming soon) |
| 5 | Settings E2E |

---

## Code layout

```
src/features/settings/
├── screens/
│   └── SettingsScreen.tsx
├── components/
│   ├── PreferenceRow.tsx
│   ├── AccountSection.tsx
│   └── NotificationsSection.tsx
└── hooks/
    └── useSettings.ts

src/stores/settingsStore.ts    # full implementation
```

UserSettings shape: [schema.md](../../specs/schema.md).

---

## 1. App preferences

MVP: keep minimal — avoid settings sprawl (product principle: low cognitive load).

Suggested MVP toggles:

- `notificationsEnabled` — stored but FCM not wired
- (Optional) reduce motion override if not handled purely in CSS

Write through `settingsStore` → Dexie → sync queue (04).

| Edge case | Behavior |
|---|---|
| First visit | Sensible defaults (`notificationsEnabled: false`) |
| Offline change | Local persist; sync when online |
| Invalid stored shape | Migration default in Dexie upgrade |

---

## 2. Account settings

Show account state: **Guest (anonymous)** or linked email/provider.

Actions:

- **Create account** / **Sign in** — link credential to anonymous UID (04)
- **Sign out** — clarify data impact: local data may remain; sync requires auth

Copy must be calm and clear — no alarmist warnings.

| Edge case | Behavior |
|---|---|
| Link succeeds | Same UID; Firestore path unchanged |
| Link conflict (email in use) | Clear error; suggest sign-in flow |
| Sign out | Policy: keep local data vs clear — **default: keep local, stop sync until re-auth** |

---

## 3. Notifications

UI: toggle for `notificationsEnabled`. When FCM is not implemented:

- Toggle persists but show helper text: "Reminders coming soon"
- Do not request browser permission in MVP unless FCM ships

| Edge case | Behavior |
|---|---|
| User enables notifications pre-FCM | Save preference; no permission prompt |
| Permission denied later | Degrade gracefully when FCM added |

---

## 4. End-to-end testing

Add `e2e/specs/settings.spec.ts`.

| Scenario | Asserts |
|---|---|
| Open Settings from IDLE | Screen renders |
| Toggle preference | Persists after reload |
| Account section visible | Shows guest or linked state |
| Settings blocked mid-session | Shell guard from 01 |

Mock or emulator auth for link flow tests; skip if no emulator in CI.

---

## Acceptance criteria

- **AC-1.** Settings reachable from IDLE; guarded during active session
- **AC-2.** Preferences persist to Dexie and survive reload
- **AC-3.** Account section reflects anonymous vs linked state
- **AC-4.** Account link preserves existing local tasks (same UID)
- **AC-5.** Notifications toggle saves but does not break offline usage
- **AC-6.** No due-date, theme, or feature-creep settings in MVP
- **AC-7.** `settings.spec.ts` passes in CI

---

## Risks

| Risk | Mitigation |
|---|---|
| Settings bloat | Cap MVP toggles; defer to post-MVP |
| Auth UX confusion | Short copy; link to 04 auth flows |
| Toggle without backend | Label as coming soon |

## Open questions

1. Sign out: clear local data or keep?
2. When to show account upgrade prompt (first sync? after N sessions?)?
3. Export/delete my data for privacy — MVP or later?
