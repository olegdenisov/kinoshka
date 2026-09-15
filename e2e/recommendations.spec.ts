import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'

// Свежий (пустой) браузерный контекст — Playwright уже изолирует storage
// между тестами по умолчанию (см. план, Task 8), поэтому localStorage
// kinoshka:favorites пуст и на /recommendations рендерится EmptyState без
// единого запроса к API — Recommendations.tsx проверяет ids.length === 0
// до AsyncBoundary/useFavoriteMovies().
test('recommendations page renders empty state for empty favorites and has no critical a11y violations', async ({
  page,
}) => {
  await page.goto('/recommendations')

  await expect(page.getByText('No favorites yet')).toBeVisible()

  await checkA11y(page)
})
