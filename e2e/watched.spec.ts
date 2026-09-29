import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'
import { firstMovieCard } from './utils/movieCard'

test('watched: mark on movie page, persists to /watched, unmark empties the list', async ({
  page,
}) => {
  await page.goto('/')

  const firstCard = firstMovieCard(page)
  await expect(
    firstCard,
    'Home page rails returned no movie cards — check the demo-tier API quota ' +
      '(200 req/day, see AGENTS.md) or API connectivity before assuming a real regression',
  ).toBeVisible()
  await firstCard.click()

  await expect(page).toHaveURL(/\/movie\/.+/)
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toBeVisible()
  const title = (await heading.textContent())?.trim()
  if (!title) {
    throw new Error('Movie page h1 has no title text')
  }

  const watchedButton = page.getByRole('button', {
    name: 'Watched',
    exact: true,
  })
  await expect(watchedButton).toHaveAttribute('aria-pressed', 'false')
  await watchedButton.click()
  await expect(watchedButton).toHaveAttribute('aria-pressed', 'true')

  // Полная перезагрузка через goto — доказывает персист через localStorage
  // (kinoshka:watched), а не состояние в памяти SPA.
  await page.goto('/watched')

  await expect(
    page.getByRole('link', { name: title, exact: true }).first(),
  ).toBeVisible()

  await checkA11y(page)

  await page.getByRole('link', { name: title, exact: true }).first().click()
  await expect(page).toHaveURL(/\/movie\/.+/)
  await expect(watchedButton).toHaveAttribute('aria-pressed', 'true')
  await watchedButton.click()
  await expect(watchedButton).toHaveAttribute('aria-pressed', 'false')

  await page.goto('/watched')

  await expect(page.getByText('No watched titles yet')).toBeVisible()
})
