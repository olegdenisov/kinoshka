.PHONY: dev build typecheck build-only lint format format-check preview install hooks clean check generate-api test test-watch coverage audit analyze size knip e2e e2e-install sentry-telemetry lighthouse

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

# Локальный dev-smoke-луп Lighthouse CI (не авторитетный источник порогов — см.
# lighthouserc.cjs и AGENTS.md/docs/plans/20260915-lighthouse-ci.md). Требует
# системный Chrome (lhci запускает его через chrome-launcher) — на машине только
# с Playwright-бандлованным Chromium упадёт с NO_USABLE_CHROME; это известное
# предусловие, не решается этим таргетом. @lhci/cli намеренно не в
# package.json'а devDependencies (см. план) — версия запинена прямо здесь.
lighthouse: build-only
	pnpm dlx @lhci/cli@0.15.1 autorun --config=./lighthouserc.cjs \
	  --upload.target=filesystem \
	  --upload.outputDir=.lighthouseci \
	  --collect.startServerCommand='pnpm exec vite preview --port 4173 --strictPort' \
	  --collect.startServerReadyPattern='Local:' \
	  --collect.url=http://localhost:4173 \
	  --collect.url=http://localhost:4173/search \
	  --collect.url=http://localhost:4173/movie/666 \
	  --collect.url=http://localhost:4173/profile
