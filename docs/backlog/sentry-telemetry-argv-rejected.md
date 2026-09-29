---
worth: later
where: sentry-telemetry.config.ts
added: 2026-09-29
---

# telemetry-as-code: билдеры алертов дают argv, который реальный аккаунт отвергает

Перенесено из `.claude/rules/sentry.md` (там это был журнал состояния, а не правило).
Контекст: `docs/plans/completed/20260915-telemetry-dashboard-sentry-alerts.md`.

- Оба билдера алертов (`failure_rate()` и `p75(measurements.lcp)`) формируют argv, который аккаунт
  отвергает: `--dataset transactions` отключён на сервере, CLI 0.44.1 не принимает датасет-замену,
  payload триггера шире, чем описано в `--help`.
- `ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT = 5` не проверен вживую.
- Не проверено, меняется ли статус транзакции браузерного SPA на необработанном исключении. Если
  `failure_rate()` в проде остаётся 0 — перейти на явный `count()` по `errors` и переименовать.
- INP/CLS-виджеты дашборда — заглушки (`TODO(Post-Completion)`): это standalone-спаны, датасет
  не подтверждён. Алерт есть только на LCP.

Что делать: подобрать рабочий датасет/CLI-версию, прогнать `make sentry-telemetry` против реального
аккаунта и зафиксировать пороги.
