---
paths:
  - 'src/features/profile/**'
  - 'src/pages/profile/**'
  - 'src/shared/lib/storage/**'
  - 'src/shared/lib/profileAriaLabel.ts'
  - 'src/shared/ui/AvatarCircle/**'
  - 'src/widgets/mobile-chrome/**'
  - 'src/widgets/header/**'
  - 'e2e/profile.spec.ts'
---

# Profile (`@features/profile`) and storage failures

Client-only profile ahead of real auth (Phase 5). History: `docs/plans/completed/20260916-user-profile-block.md`.

## Data

- Only field: display name, `kinoshka:profile` via `createStorageSlot` (`profileNameSlot`, `model/profileStorage.ts`). Invalid/over-long stored value → `''`.
- `useProfile()` → `{ name, initials, setName, clearName }`; both setters return the `boolean` from `set()`. `clearName()` uses `set('')`, not `remove()` (`remove()` doesn't notify same-tab subscribers).
- **One normalizer for write and read:** `normalizeProfileName()` = trim → truncate to `PROFILE_NAME_MAX_LENGTH` (40) **code points** → trim → `''` if no visible character. The zod read schema enforces the same rules, so whatever `setName` stores round-trips. Invisible = `\p{Cf}`/`\p{Cc}`/`\p{Zs}`/`\p{Zl}`/`\p{Zp}`/`\p{Default_Ignorable_Code_Point}`/U+2800 (`lib/visibleChars.ts`, shared regex).
- Lengths are code points (`Array.from`) so emoji surrogate pairs aren't split; grapheme clusters aren't kept intact (no `Intl.Segmenter`) — accepted. `<input maxLength>` counts UTF-16 units, so it's stricter — accepted, it's only a UI hint.
- `getInitials()` takes the first **visible** code point of each word, upper-cased with fixed `INITIALS_LOCALE = 'en'` (avoids Turkish `İ` etc.); empty name → empty initials → UI draws `ProfileIcon`.
- Bidi overrides (U+202E) mixed with visible text are kept — stripping would break legitimate RTL names; impact is cosmetic and local.

## Storage failures (`createStorageSlot`, `@shared/lib`)

- `get()` falls back on error (a `SecurityError` used to blank the app via `GlobalErrorBoundary`); `set()` returns `false` without notifying subscribers; `remove()` is silent to the user.
- Only `/profile` surfaces failures in the UI, and favorites gates `trackEvent('favorite added')` on the result. Theme/genre callers still ignore it — deliberate.
- `setStorageErrorReporter()` is **module-level**, shared by all slots, `null` by default (quiet tests/dev). `get()` reports via `queueMicrotask` (keeps `getSnapshot` pure); `set()`/`remove()` report synchronously. Dedup per `operation:key` with a 60s cooldown (`REPORT_COOLDOWN_MS`). `initSentry()` wires it to `captureException(..., { level: 'warning', tags: { storageKey, storageOperation } })` — never the value.

## `/profile` page (`Profile.tsx`)

- Every control does something real: name form, quick links (`/favorites` with count, `/popular`, `/recommendations`), Light/Dark/System radio group (`<fieldset>` + `<legend><h2>`), `Clear name` (only when a name is set). **No disabled auth stubs** — "sign-in will arrive with the backend" is plain text.
- `isDirty` compares the **normalized** draft with the stored name; after a successful save the draft resets to the normalized value.
- Draft resync is adjust-state-during-render (`if (name !== prevName) { setPrevName(name); setDraft(name); setFailure(null) }`), not `key={name}` (remount loses focus after submit).
- Error alert: single `failure: { action: 'save' | 'clear'; count }` state; the `role='alert'` `<p>` is keyed on `count` so repeat failures re-announce.
- After a successful save/clear, `restoreInputFocus()` refocuses the input (Save becomes disabled / Clear unmounts, which drops focus to `<body>`), skipped when `matchMedia('(pointer: coarse)')` matches to avoid popping the virtual keyboard.
- The big avatar is a decorative (`aria-hidden`) `AvatarCircle size='lg'`, not `ProfileAvatar` — a link to the current page is noise.
- Error text uses `--danger`, not `--accent-warm` (that's the CTA color).

## `ProfileAvatar`

- `<NavLink to='/profile'>` rendered from both `Header` and `MobileHeader` (`MobileHeader` renders `rightAction ?? <ProfileAvatar />`). `aria-label` = `'Your profile'` or `` `${PROFILE_ARIA_LABEL_PREFIX}${name}` `` (prefix from `@shared/lib`, shared with `sentry.ts`).
- **`data-sentry-component='ProfileAvatar'` is load-bearing** — it keeps the name out of Sentry breadcrumbs/spans. Don't remove it. See `sentry.md`.
- Circle visuals are `AvatarCircle` (`@shared/ui`, `size: 'sm' | 'lg'`); `ProfileAvatar.module.css` styles only the link wrapper.
- Initials use `--avatar-fg` (dark in both themes' gradient, so `--text-primary` fails contrast in light). **No automated check covers this contrast** — Lighthouse runs with empty storage (icon, no text) and axe returns gradient backgrounds as `incomplete`. If a guard is needed, write a `contrast.test.ts`-style test against the gradient's two stops.

## `BottomNav`

No disabled items; `profile` → `/profile`, `path` is `string` (not nullable). Tapping the current item uses `replace` only when `` `${pathname}${search}${hash}` === it.path `` — comparing the full URL keeps `/search?q=…` filters from being erased by a tap on "Catalog".

## Route/chrome

Lazy `ProfilePage` (`page-profile` chunk). `ROUTE_CHROME['/profile'] = { active: 'profile', title: 'Profile' }`, no `activeNav`. E2E: `e2e/profile.spec.ts` (desktop only, zero API calls). Remaining dead header controls (bell, Share, footer) → `docs/backlog/dead-header-controls.md`.
