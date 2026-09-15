import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'
import { firstMovieCard } from './utils/movieCard'

test('popular page renders rank badge on first card and has no critical a11y violations', async ({
  page,
}) => {
  await page.goto('/popular')

  const firstCard = firstMovieCard(page)
  await expect(firstCard).toBeVisible()

  // PopularBadge рендерит <div role='img' aria-label='Position 1'> (либо
  // 'Position 1, change ...', если positionDiff ненулевой) для первой
  // позиции списка — см. src/entities/movie/ui/PopularBadge/PopularBadge.tsx.
  // [deviation] план предлагал /^Position 1/, но это резолвится и в
  // "Position 10, change ..." (список из 10 позиций) — strict-mode
  // violation на живых данных. Якорим границу числа явно: после "1" идёт
  // либо запятая (когда есть positionDiff), либо конец строки.
  await expect(
    page.getByRole('img', { name: /^Position 1(,|$)/ }),
  ).toBeVisible()

  await checkA11y(page)
})
