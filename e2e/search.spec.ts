import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'
import { resultsOrEmptyState } from './utils/search'

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

test('filter: selecting a genre chip and a duration preset on /search updates the URL and re-renders results', async ({
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
  // эмпирически), поэтому так нельзя отличить чипы от Type-радио/рейтинга.
  // `aria-pressed` есть у всех чипов `ChipSelect` (жанры, страны, длительность,
  // платформы, подборки), но дети свёрнутых групп не рендерятся, а Genre — первая
  // раскрытая группа с чипами, поэтому первый такой элемент — чип жанра.
  const genreChip = page.locator('button[aria-pressed]').first()
  await expect(genreChip).toBeVisible()
  await genreChip.click()

  await expect(page).toHaveURL(/genres=/)
  await expect(resultsOrEmptyState(page)).toBeVisible()

  // Длительность — в свёрнутой группе общего FilterPanel. Ждём именно ответ каталога с
  // `movieLength`: смена только URL без перезапроса (поле забыто в `areFiltersEqual`)
  // иначе прошла бы незамеченной. +1 запрос к API — шаг здесь, а не отдельным тестом (квота).
  await page.getByText('Duration', { exact: true }).click()
  const durationResponse = page.waitForResponse(
    r => r.url().includes('/v1.5/movie?') && r.url().includes('movieLength='),
  )
  await page.getByRole('button', { name: 'Under 90 min' }).click()

  await expect(page).toHaveURL(/duration=short/)
  await durationResponse
  await expect(
    page.getByRole('main').getByText('Under 90 min', { exact: true }),
  ).toBeVisible()
  await expect(resultsOrEmptyState(page)).toBeVisible()

  await checkA11y(page)
})
