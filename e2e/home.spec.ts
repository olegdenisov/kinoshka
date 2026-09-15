import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'
import { firstMovieCard } from './utils/movieCard'

test('home page renders hero + first rail card and has no critical a11y violations', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const firstCard = firstMovieCard(page)
  await expect(firstCard).toBeVisible()

  await checkA11y(page)
})
