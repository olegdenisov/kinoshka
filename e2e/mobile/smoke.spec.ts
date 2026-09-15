import { expect, test } from '@playwright/test'

import { checkA11y } from '../utils/a11y'

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

  const firstCard = page.locator('a[href^="/movie/"]').first()
  await expect(firstCard).toBeVisible()

  await checkA11y(page)
})

test('mobile search: renders mobile filter bar + results, no critical a11y violations', async ({
  page,
}) => {
  await page.goto('/search')

  // Sticky filter-bar (кнопки Filters/Sort + BottomSheet) — genuinely different
  // UX-паттерн от десктопного SearchSidebar/SearchControls, ветвится через
  // `isMobile` внутри Search.tsx (см. AGENTS.md "Responsive pattern", пункт 2).
  await expect(page.getByRole('button', { name: /^Filters/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Sort/ })).toBeVisible()

  const resultsOrEmptyState = page
    .getByText(/shown · page \d+ of \d+/)
    .or(page.getByText('Nothing found'))
  await expect(resultsOrEmptyState).toBeVisible()

  await checkA11y(page)
})

test('mobile movie detail: navigate from home, back button + Overview content, no critical a11y violations', async ({
  page,
}) => {
  await page.goto('/')

  // Стабильный селектор карточки фильма — по href-паттерну react-router
  // (/movie/:id), не голый getByRole('link').first(). См. Technical Details в плане.
  const firstCard = page.locator('a[href^="/movie/"]').first()
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
