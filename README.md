# Kino•shka

Каталог фильмов — SPA с лентой на главной, поиском, фильтрами и страницами фильмов (обзор, каст, медиа).

## Стек

- **React 19** + **TypeScript 6** + **Vite 8**
- **React Router 7** — клиентская маршрутизация
- **React Compiler** — автоматическая мемоизация (`babel-plugin-react-compiler`); ручные `useMemo` / `useCallback` / `memo` не нужны
- **ESLint 10** + `typescript-eslint`

## Команды

```bash
pnpm dev        # dev-сервер с HMR
pnpm build      # проверка типов (tsc -b) + production-сборка
pnpm lint       # ESLint по всем TS/TSX-файлам
pnpm preview    # раздача production-сборки локально
```

> Тест-раннер не настроен.

## Архитектура

Проект следует [Feature-Sliced Design](https://feature-sliced.design/):

```
src/
├── app/        # провайдеры, роутер, глобальные стили
├── pages/      # компоненты уровня роута
├── widgets/    # крупные переиспользуемые секции UI (хедер, нижняя навигация, рейлы)
├── features/   # интерактивные фичи (catalog-filter)
├── entities/   # бизнес-объекты (movie — типы, данные, UI)
└── shared/     # утилиты и примитивы (lib/, ui/)
```

Направление импортов: `pages → widgets → features → entities → shared`. Импорты вверх по слоям запрещены.

## Адаптивность

Страницы и виджеты реализованы парами `*Desktop.tsx` / `*Mobile.tsx`. Хук `useViewport` (`src/shared/lib/useViewport.ts`) определяет, какой вариант отрендерить.

## Соглашения

- **Типы:** использовать `type`, не `interface`
- **TypeScript:** включены `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` — `enum` и `namespace` запрещены
- **Иконки:** SVG-спрайт `public/icons.svg`; ссылка через `<use href="/icons.svg#<id>" />`
- **Шрифты:** Instrument Serif, Instrument Sans, JetBrains Mono (Google Fonts, загружаются в `index.html`) — новые шрифты не добавлять
