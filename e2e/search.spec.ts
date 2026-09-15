import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { checkA11y } from './utils/a11y'

// Либо результаты нашлись (счётчик "N shown · page X of Y" в Search.tsx), либо
// показан EmptyState 'Nothing found' — оба исхода подтверждают, что грид
// действительно завершил перерендер по новым параметрам (не завис в loading).
const resultsOrEmptyState = (page: Page) =>
  page.getByText(/shown · page \d+ of \d+/).or(page.getByText('Nothing found'))

test('search: submitting a query from the hero navigates to /search with results or empty state', async ({
  page,
}) => {
  await page.goto('/')

  const input = page.getByPlaceholder(/films from 2024/i)
  await input.fill('batman')
  await input.press('Enter')

  // Проверяем не только что параметр `q` появился, но что он реально несёт
  // введённый текст — без этого no-op сабмит-хендлер, ведущий на
  // `/search?q=` с пустым/неверным значением, тоже прошёл бы тест, пока
  // где-то рендерится результаты-или-empty-state.
  await expect(page).toHaveURL(/\/search\?.*q=batman/)
  await expect(resultsOrEmptyState(page)).toBeVisible()

  await checkA11y(page)
})

test('filter: selecting a genre chip on /search updates the URL and re-renders results', async ({
  page,
}) => {
  await page.goto('/search')

  // Дожидаемся, что первичный (без фильтров) запрос каталога уже отрисовался,
  // прежде чем менять фильтры — иначе клик по жанру попадает на ещё не
  // завершившийся первый Suspense-фетч и обе проверки ниже флейково гонятся
  // с первым запросом к живому API за один и тот же 10s expect-таймаут.
  await expect(resultsOrEmptyState(page)).toBeVisible()

  // Первый доступный чип жанра — не хардкодим название. `getByRole(..., { pressed })`
  // матчит все кнопки без явного `aria-pressed` как "не нажатые" (проверено
  // эмпирически), поэтому так нельзя отличить чипы жанра от Type-радио/рейтинга.
  // Единственные кнопки на странице, у которых атрибут `aria-pressed` реально
  // присутствует в разметке — чипы GenreSelector (см. `aria-pressed={active}` в
  // GenreSelector.tsx, тот же атрибут уже используется в GenreSelector.test.tsx) —
  // поэтому скоупим напрямую по присутствию атрибута, не по CSS-классу.
  const genreChip = page.locator('button[aria-pressed]').first()
  await expect(genreChip).toBeVisible()
  await genreChip.click()

  await expect(page).toHaveURL(/genres=/)
  await expect(resultsOrEmptyState(page)).toBeVisible()

  await checkA11y(page)
})
