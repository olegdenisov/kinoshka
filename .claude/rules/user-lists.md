---
paths:
  - 'src/features/{watched,watchlist}/**'
  - 'src/pages/{watched,watchlist}/**'
---

# Watched and Watchlist

- **Separate slices, not a generalized `favorites`:** duplicated structure is preferred over a shared abstraction — less coupling between features.
- **Watched and Watchlist are independent:** no shared facade, no auto-removal from the watchlist when marked watched — linking the keys would be hidden magic nobody asked for. Store ids only; don't add dates, ratings, progress or priority without an explicit request.
