.PHONY: dev build typecheck build-only lint format format-check preview install hooks clean check generate-api test test-watch coverage audit analyze size knip e2e e2e-install sentry-telemetry

dev:
	pnpm dev

build:
	pnpm build

typecheck:
	pnpm exec tsc -b

build-only:
	pnpm exec vite build

lint:
	pnpm lint

format:
	pnpm format

format-check:
	pnpm format:check

preview:
	pnpm preview

install:
	pnpm install

hooks:
	pnpm exec husky

clean:
	rm -rf dist node_modules

check: format-check lint build

generate-api:
	pnpm generate-api
	node -e "const fs=require('fs'),f='src/shared/api/instance.gen.ts',c=fs.readFileSync(f,'utf8');c.startsWith('// @ts-nocheck')||fs.writeFileSync(f,'// @ts-nocheck\n'+c)"

test:
	pnpm vitest run

test-watch:
	pnpm vitest

coverage:
	pnpm vitest run --coverage

audit:
	pnpm audit --audit-level high --prod

analyze:
	ANALYZE=true pnpm exec vite build

size:
	pnpm exec size-limit

knip:
	pnpm exec knip

e2e:
	pnpm exec playwright test

e2e-install:
	pnpm exec playwright install --with-deps chromium webkit

# Требует предварительного `sentry auth login` (см. docs/telemetry-runbook.md) — на машине,
# где писался этот план, уже выполнено. Намерение: создаёт Metric Alert (error rate)/Metric Alert
# (LCP P75)/Dashboard "Kinoshka Telemetry" в реальном Sentry-аккаунте (create-if-missing, не полная
# синхронизация — см. sentry-telemetry.config.ts).
#
# ⚠️ На момент написания (2026-09-16) оба `alert metrics create`-вызова ГАРАНТИРОВАННО падают на
# реальном аккаунте — сервер отклоняет dataset=transactions, а --trigger payload не совпадает с
# ожидаемой сервером схемой (полный разбор — sentry-telemetry.config.ts, buildMetricAlertArgs, и
# план 20260915-telemetry-dashboard-sentry-alerts.md, Post-Completion). Команда не является рабочей
# "из коробки" — прежде чем полагаться на её результат, см. три пути решения в Post-Completion.
sentry-telemetry:
	node --env-file-if-exists=.env.local provision-sentry-telemetry.ts
