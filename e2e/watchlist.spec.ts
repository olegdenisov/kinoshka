import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'
import { firstMovieCard } from './utils/movieCard'

test('watchlist: add on movie page, independent from Watched, remove empties the list', async ({
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

  const watchlistButton = page.getByRole('button', {
    name: 'Watchlist',
    exact: true,
  })
  await expect(watchlistButton).toHaveAttribute('aria-pressed', 'false')
  await watchlistButton.click()
  await expect(watchlistButton).toHaveAttribute('aria-pressed', 'true')

  // Полная перезагрузка через goto — доказывает персист через localStorage,
  // а не состояние в памяти SPA.
  await page.goto('/watchlist')

  const card = page.getByRole('link', { name: title, exact: true }).first()
  await expect(card).toBeVisible()

  await checkA11y(page)

  await card.click()
  await expect(page).toHaveURL(/\/movie\/.+/)
  await expect(watchlistButton).toHaveAttribute('aria-pressed', 'true')

  // Независимость: отметка Watched не убирает фильм из Watchlist.
  const watchedButton = page.getByRole('button', {
    name: 'Watched',
    exact: true,
  })
  await watchedButton.click()
  await expect(watchedButton).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/watchlist')
  await expect(
    page.getByRole('link', { name: title, exact: true }).first(),
  ).toBeVisible()

  await page.getByRole('link', { name: title, exact: true }).first().click()
  await expect(watchlistButton).toHaveAttribute('aria-pressed', 'true')
  await watchlistButton.click()
  await expect(watchlistButton).toHaveAttribute('aria-pressed', 'false')

  await page.goto('/watchlist')
  await expect(page.getByText('Nothing in your watchlist yet')).toBeVisible()
})
