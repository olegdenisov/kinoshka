import { expect, test } from '@playwright/test'

import { checkA11y } from '../utils/a11y'
import { firstMovieCard } from '../utils/movieCard'
import { resultsOrEmptyState } from '../utils/search'

// Урезанный smoke-набор под `devices['iPhone 13']` (см. playwright.config.ts —
// project 'Mobile Safari', свой testDir: './e2e/mobile'). Roadmap просит mobile
// project «хотя бы» на /, /search, /movie/:id (см. Solution Overview плана) —
// каждый тест дополнительно проверяет ровно ту mobile-specific UI-развилку,
// которая реально ветвится через `useViewport()` (AppLayout/Search.tsx, см.
// AGENTS.md "Responsive pattern"), а не CSS-only вариант того же дерева.

test('mobile home: renders mobile chrome (BottomNav) + first rail card, no critical a11y violations', async ({
  page,
}) => {
  await page.goto('/')

  // BottomNav — единственный <nav> на странице, рендерится только когда
  // AppLayout выбрал mobile chrome (isMobile === true, см. AppLayout.tsx) —
  // Header (desktop) не мультирует свой собственный <nav> на этом брейкпоинте.
  const bottomNav = page.getByRole('navigation')
  await expect(bottomNav).toBeVisible()
  await expect(bottomNav.getByRole('button', { name: 'Home' })).toBeVisible()

  const firstCard = firstMovieCard(page)
  await expect(firstCard).toBeVisible()

  await checkA11y(page)
})

test('mobile search: renders mobile filter bar + results, opens/closes the Filters BottomSheet, no critical a11y violations', async ({
  page,
}) => {
  await page.goto('/search')

  // Sticky filter-bar (кнопки Filters/Sort + BottomSheet) — genuinely different
  // UX-паттерн от десктопного SearchSidebar/SearchControls, ветвится через
  // `isMobile` внутри Search.tsx (см. AGENTS.md "Responsive pattern", пункт 2).
  const filtersBtn = page.getByRole('button', { name: /^Filters/ })
  await expect(filtersBtn).toBeVisible()
  await expect(page.getByRole('button', { name: /^Sort/ })).toBeVisible()

  await expect(resultsOrEmptyState(page)).toBeVisible()

  await checkA11y(page)

  // Открываем Filters-BottomSheet — единственный способ покрыть регрессию
  // Task 2 (a11y-фикс .closeBtn -> aria-label='Dismiss'), т.к. ни один спек
  // в сьюте раньше не открывал BottomSheet вообще. Стоит 0 доп. запросов к
  // API (чисто клиентский тоггл состояния).
  await filtersBtn.click()

  // Обе панели (Filters и Sort) смонтированы одновременно (см. AGENTS.md/план,
  // "на мобильном /search смонтированы два BottomSheet одновременно") —
  // закрытая остаётся в DOM/a11y-дереве (translateY(100%), не display:none),
  // поэтому `toBeVisible()` не различает открытое/закрытое состояние. Реальный
  // визуальный признак открытости — пересечение с viewport, отсюда
  // `toBeInViewport()` вместо `toBeVisible()`.
  const showResultsBtn = page.getByRole('button', { name: 'Show results' })
  await expect(showResultsBtn).toBeInViewport()

  await checkA11y(page)

  // Filters — первый в DOM из двух BottomSheet (JSX-порядок в Search.tsx),
  // Sort — второй; оба .closeBtn имеют одинаковый aria-label='Dismiss', поэтому
  // скоупим по document order через .first(), не по CSS-классам.
  const dismissBtn = page.getByRole('button', { name: 'Dismiss' }).first()
  await dismissBtn.click()

  await expect(showResultsBtn).not.toBeInViewport()
})

test('mobile movie detail: navigate from home, back button + Overview content, no critical a11y violations', async ({
  page,
}) => {
  await page.goto('/')

  const firstCard = firstMovieCard(page)
  await expect(firstCard).toBeVisible()
  await firstCard.click()

  await expect(page).toHaveURL(/\/movie\/.+/)

  // На мобильном /movie/:id MobileHeader рендерит кнопку "назад" вместо
  // логотипа (MOVIE_CHROME.onBack === true, см. AppLayout.tsx) — mobile-only
  // UI-развилка, отсутствующая на десктопном Header.
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()

  // Overview — таб по умолчанию (Movie.tsx: useState('Overview')). 'Synopsis' —
  // текст section-head'а именно OverviewTab, уникален для дефолтного таба.
  await expect(page.getByText('Synopsis', { exact: true })).toBeVisible()

  await checkA11y(page)
})
