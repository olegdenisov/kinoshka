---
paths:
  - 'src/shared/lib/storage/**'
  - 'src/features/*/model/**'
---

# `localStorage` slots (`createStorageSlot`)

- `get()` memoizes the parsed value against the raw string. The memo is dropped on `set()`, so the next `get()` of an array/object returns a new reference — never compare slot values by reference.
- **Stores are the only readers of slots** (`createPersistedStore`, persist `storage` adapter over the slot). Components read the store, not the slot; the bare-JSON format is kept (no `{ state, version }` envelope) because the inline theme script in `index.html` reads `kinoshka:theme` directly.
- **Failed write rolls the store back** to the stored content via `persist.rehydrate()`; `commit()` returns `false`. Gate side effects on it.
- **Own notifications are skipped:** the slot notifies subscribers synchronously inside its own `set()`, so the adapter holds an "own write" flag around `setItem`; other tabs' `storage` events trigger `rehydrate()`.
- `get()` falls back on any error; `set()` returns `false` without notifying subscribers; `remove()` is silent to the user **and doesn't notify same-tab subscribers** — to clear a value that UI shows, `set()` an empty value instead.
- Read-modify-write (`toggle`/`add`/`remove` over an id list) reads the store's `get()`, not the hook's closure — otherwise two writes in one tick overwrite each other.
- Only `/profile` surfaces write failures in the UI; theme/genre callers ignore them — deliberate.
- `setStorageErrorReporter()` is module-level, shared by all slots, `null` by default; wired to Sentry in `initSentry()`. Report the key and operation, **never the value**.
