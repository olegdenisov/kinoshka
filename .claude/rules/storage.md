---
paths:
  - 'src/shared/lib/storage/**'
  - 'src/features/*/model/**'
---

# `localStorage` slots (`createStorageSlot`)

- `get()` memoizes the parsed value against the raw string — keep it: repeated reads (preloaded state, `subscribeSlot`, `toggleFavorite`) must not return a fresh object for an unchanged value.
- `get()` falls back on any error; `set()` returns `false` without notifying subscribers; `remove()` is silent to the user **and doesn't notify same-tab subscribers** — to clear a value that UI shows, `set()` an empty value instead.
- Read-modify-write (`toggle`/`add`/`remove` over an id list) reads `slot.get()`, not the hook's closure — otherwise two writes in one tick overwrite each other.
- Only `/profile` surfaces write failures in the UI; theme/genre callers ignore them — deliberate.
- `setStorageErrorReporter()` is module-level, shared by all slots, `null` by default; wired to Sentry in `initSentry()`. Report the key and operation, **never the value**.

## Store slices (RTK)

- **Slices are the only readers of slots in the UI.** Components read state from the store; a slot is touched directly only by persistence (`persistSlice`/`subscribeSlot`) and by the `toggleFavorite` mutation.
- **Rollback is synchronous.** The persist listener runs inside `dispatch` (before the first `await`), so by the time `dispatch` returns the state is either written or rolled back — callers (`useProfile().setName`) compare the state after dispatch to get the `boolean`. `getOriginalState()` is only valid in that synchronous part. `rollback` is excluded from the persist matcher, `hydrated` (tab sync) is excluded by the caller — otherwise they write back what they just read.
- **Favorites are written only through the `toggleFavorite` mutation**, never by a plain action: the next value is computed from the slot ("server"), not from state (state already holds the optimistic change). Other slices persist via listener only. On failure it rolls state back to the slot value (`rolledBack`), not by a reverse toggle — a concurrent toggle's `hydrated` may already have changed state; `rolledBack` is separate from `hydrated` so a rollback doesn't invalidate `Recommendations`.
- `subscribeSlot` skips the dispatch when the slot value equals state (compared via `JSON.stringify`): `slot.subscribe` also fires on this tab's own `set()`, and a stale `hydrated` would overwrite a second write in the same tick.
