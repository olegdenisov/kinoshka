.PHONY: dev build lint preview install clean check generate-api

dev:
	pnpm dev

build:
	pnpm build

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
