---
paths:
  - 'src/features/profile/**'
  - 'src/pages/profile/**'
  - 'src/shared/ui/AvatarCircle/**'
  - 'src/widgets/mobile-chrome/**'
---

# Profile (`@features/profile`, `/profile`), `BottomNav`

Client-only profile ahead of real auth.

- **One normalizer for write and read** — whatever `setProfileName` stores must round-trip through the persist schema (`persistOptions` falls back to the default on invalid data).
- Name length is counted in code points, not grapheme clusters — accepted. Bidi overrides mixed with visible text are kept (stripping breaks legitimate RTL names) — accepted.
- **No disabled auth stubs** — every control on `/profile` does something real.
- Draft resync is adjust-state-during-render, not `key={name}` (a remount loses focus after submit). There's no "save failed" message: persist write errors are invisible (`storage.md`).
- Initials use `--avatar-fg`, not `--text-primary` (fails contrast on the gradient in light theme). **No automated check covers this contrast** — Lighthouse runs with empty storage and axe returns gradients as `incomplete`.
- **`BottomNav`:** tapping the current item uses `replace` only when the full `pathname + search + hash` matches — otherwise a tap on "Catalog" erases `/search` filters. No free slots: new list pages are reached via quick links on `/profile`.
