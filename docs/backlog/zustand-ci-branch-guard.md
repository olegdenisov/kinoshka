---
worth: yes
where: .github/workflows/ci.yml
added: 2026-10-02
---

# zustand: CI на PR в ветку и запрет слияния в main

Task 1 плана `docs/plans/20261001-zustand-migration.md`, вынесен из плана: субагент упёрся в блокировку классификатора («CI Bypass») на правке workflow-файлов и `git push`, а Task 2–19 от него не зависят.

Что осталось сделать:

- в ветке `zustand`: `on.pull_request.branches: [main, zustand]` в `ci.yml` и `codeql.yml` (как в `rtk`, `git show rtk:.github/workflows/ci.yml`); job `branch-guard` не трогать; запушить `zustand` в `origin`
- от `main`, ветка `ci/block-zustand-merge`: в `branch-guard` заменить `BLOCKED_BRANCHES: rtk` на `BLOCKED_BRANCHES: rtk zustand`, обновить комментарий над job'ом; PR в `main` без файла плана
- слияние guard-PR в защищённый `main` делает человек
- проверка: draft-PR `zustand → main` — `branch-guard` красный, merge заблокирован, PR закрыть без слияния
- `make lint && make format-check` зелёные

Пока guard-PR не слит, `zustand` защищена от слияния в `main` только договорённостью, не CI.
