.PHONY: dev build typecheck build-only lint preview install hooks clean check generate-api test test-watch coverage

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

preview:
	pnpm preview

install:
	pnpm install

hooks:
	pnpm exec husky

clean:
	rm -rf dist node_modules

check: lint build

generate-api:
	pnpm generate-api
	node -e "const fs=require('fs'),f='src/shared/api/instance.gen.ts',c=fs.readFileSync(f,'utf8');c.startsWith('// @ts-nocheck')||fs.writeFileSync(f,'// @ts-nocheck\n'+c)"

test:
	pnpm vitest run

test-watch:
	pnpm vitest

coverage:
	pnpm vitest run --coverage