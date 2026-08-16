# Kino•shka

[![CI](https://github.com/olegdenisov/kinoshka/actions/workflows/ci.yml/badge.svg)](https://github.com/olegdenisov/kinoshka/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
[![Feature-Sliced Design](https://img.shields.io/badge/Architecture-FSD-blueviolet)](https://feature-sliced.design/)

Каталог фильмов — SPA с лентой на главной, поиском, фильтрами, страницами фильмов (обзор, каст, медиа) и списком избранного (хранится в localStorage браузера, без синхронизации между устройствами).

## Стек

- **React 19** + **TypeScript 6** + **Vite 8**
- **React Router 7** — клиентская маршрутизация
- **React Compiler** — автоматическая мемоизация (`babel-plugin-react-compiler`); ручные `useMemo` / `useCallback` / `memo` не нужны
- **Vitest** + **Testing Library** + **MSW** — юнит и интеграционные тесты, мокирование API-запросов
- **Zod** — валидация данных (localStorage, API-границы)
- **oxlint** — Rust-линтер (TS/React/jsx-a11y правила)
- **husky** + **lint-staged** + **commitlint** — pre-commit линтинг и conventional commits (`pnpm commit`)

## Команды

```bash
make dev          # dev-сервер с HMR
make build        # проверка типов (tsc -b) + production-сборка
make lint         # oxlint по всем TS/TSX-файлам
make preview      # раздача production-сборки локально
make test         # запустить тесты один раз
make test-watch   # тесты в watch-режиме
make coverage     # отчёт покрытия
make generate-api # регенерировать API-клиент из OpenAPI-спецификации
make check        # lint + build (полная проверка)
make hooks        # установить git-хуки husky
make audit        # pnpm audit (prod-зависимости, high severity)
make clean        # удалить dist и node_modules
```

## Архитектура

Проект следует [Feature-Sliced Design](https://feature-sliced.design/):

```
src/
├── app/        # провайдеры, роутер, глобальные стили
├── pages/      # компоненты уровня роута
├── widgets/    # крупные переиспользуемые секции UI (header, mobile-chrome, movie-rail, search-sidebar)
├── features/   # интерактивные фичи (catalog-filter, favorites)
├── entities/   # бизнес-объекты (movie — типы, данные, UI)
└── shared/     # утилиты и примитивы (lib/, ui/)
```

Направление импортов: `pages → widgets → features → entities → shared`. Импорты вверх по слоям запрещены.

## Адаптивность

Страницы и виджеты реализованы парами `*Desktop` / `*Mobile`. Хук `useViewport` (`src/shared/lib/viewport/useViewport.ts`) определяет, какой вариант отрендерить. Breakpoint: **720px**.

## Структура компонентов

Каждый компонент живёт в собственной директории с CSS-модулем:

```
ComponentName/
├── index.tsx
└── ComponentName.module.css
```

Каждый слайс `widgets/` и `features/` предоставляет публичный API через `index.ts` в корне слайса. Всегда импортируй через него, не через внутренние пути:

```ts
import { Header } from '@widgets/header' // ✓
import { Header } from '@widgets/header/ui/Header' // ✗
```

## Соглашения

- **Типы:** использовать `type`, не `interface`
- **TypeScript:** включены `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` — `enum` и `namespace` запрещены
- **Стили:** CSS Modules (`ComponentName.module.css`), hover-состояния через `:hover`, не через `useState`
- **Иконки:** SVG-спрайт `public/icons.svg`; ссылка через `<use href="/icons.svg#<id>" />`
- **Шрифты:** Instrument Serif, Instrument Sans, JetBrains Mono (Google Fonts, загружаются в `index.html`) — новые шрифты не добавлять
