---
paths:
  - 'src/shared/lib/storage/**'
  - 'src/features/*/model/**'
---

# `localStorage` slots (`createStorageSlot`)

- `get()` memoizes the parsed value against the raw string — required, `useStorageSlot` feeds it to `useSyncExternalStore` as `getSnapshot`, which needs a stable reference.
- `get()` falls back on any error; `set()` returns `false` without notifying subscribers; `remove()` is silent to the user **and doesn't notify same-tab subscribers** — to clear a value that UI shows, `set()` an empty value instead.
- Read-modify-write (`toggle`/`add`/`remove` over an id list) reads `slot.get()`, not the hook's closure — otherwise two writes in one tick overwrite each other.
- Only `/profile` surfaces write failures in the UI; theme/genre callers ignore them — deliberate.
- `setStorageErrorReporter()` is module-level, shared by all slots, `null` by default; wired to Sentry in `initSentry()`. Report the key and operation, **never the value**.
