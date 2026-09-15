import type { Locator, Page } from '@playwright/test'

// Стабильный селектор карточки фильма — по href-паттерну react-router
// (/movie/:id), не голый getByRole('link').first(), который резолвится в
// логотип шапки. См. Technical Details в плане
// docs/plans/20260912-e2e-playwright-axe.md.
export const firstMovieCard = (page: Page): Locator =>
  page.locator('a[href^="/movie/"]').first()
