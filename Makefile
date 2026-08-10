.PHONY: dev build typecheck build-only lint format format-check preview install hooks clean check generate-api test test-watch coverage audit

dev:
	pnpm dev

build:
	pnpm build

typecheck:
	pnpm exec tsc --noEmit

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
