import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'

test('home page renders hero + first rail card and has no critical a11y violations', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Стабильный селектор карточки фильма — по href-паттерну react-router
  // (/movie/:id), не голый getByRole('link').first(), который резолвится в
  // логотип шапки. См. Technical Details в плане.
  const firstCard = page.locator('a[href^="/movie/"]').first()
  await expect(firstCard).toBeVisible()

  await checkA11y(page)
})
