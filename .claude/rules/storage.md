---
paths:
  - 'src/shared/lib/persist/**'
  - 'src/features/*/model/**'
  - 'src/entities/movie/model/dictionaries.ts'
---

# Persisted atoms (`withLocalStorage` + `persistOptions`)

- Every persisted atom is `.extend(withLocalStorage(persistOptions({ key, schema, fallback, … })))`; don't call `withLocalStorage` with raw options.
- **TTL:** in `@reatom/core@1001.3.0` the persist default `time` is ~24.8 days and an expired record is deleted on read (docs and `main` say `Number.MAX_SAFE_INTEGER`). `persistOptions` sets `PERSIST_FOREVER_MS`; `Infinity` is unusable (serializes to `null`). Drop the workaround once the core default changes.
- **Validation is Zod `safeParse` inside `fromSnapshot`, not the `schema` option:** `schema` throws `TypeError` out of the atom read on invalid data, whereas invalid JSON or a value without the `PersistRecord` envelope already yields the default. `fromSnapshot` gets one argument.
- Non-JSON state (`Set`) needs an explicit `toSnapshot`/`fromValid`: `JSON.stringify(new Set([1]))` is `{}`. `schema` describes the stored format, not the atom state.
- **No write-failure signal (deliberate, vs `main`):** persist swallows `setItem` errors (`console.warn`), the atom still updates in memory, and with `localStorage` unavailable it falls back to memory. Don't build "saved" UI, analytics or Sentry reports on write success.
- Cross-tab sync works through the `storage` event only while the atom is connected (subscribed).
- Old raw (non-envelope) values from `main` read as absent → default; the branch isn't merged, so there is no migration.
