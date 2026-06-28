.PHONY: dev build typecheck build-only lint preview install clean check generate-api test test-watch coverage

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

clean:
	rm -rf dist node_modules

check: lint build

generate-api:
	pnpm generate-api

test:
	pnpm vitest run

test-watch:
	pnpm vitest

coverage:
	pnpm vitest run --coverage