import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'
import { firstMovieCard } from './utils/movieCard'

test('favorites: add on home, persists after reload, appears on /favorites', async ({
  page,
}) => {
  await page.goto('/')

  const firstCard = firstMovieCard(page)
  await expect(
    firstCard,
    'Home page rails returned no movie cards — check the demo-tier API quota ' +
      '(200 req/day, see AGENTS.md) or API connectivity before assuming a real regression',
  ).toBeVisible()

  // Рейлы рендерятся в фиксированном DOM-порядке (Home.tsx), но четыре
  // Suspense-границы резолвятся независимо, поэтому карточка идентифицируется
  // по названию (title), а не по голой позиции после reload.
  const title = await firstCard.textContent()
  if (!title) {
    throw new Error('First movie card on / has no title text')
  }

  // Скоуп favorite-кнопки к конкретной карточке через относительный XPath от
  // самой ссылки — Link (title) живёт в `.info`, а `.info` и `.posterContainer`
  // (где рендерится favorite-кнопка) оба являются прямыми детьми одного
  // `.card`-узла (см. Card.tsx). Значит ровно два уровня вверх от Link'а
  // приводят к `.card`, внутри которого единственная favorite-кнопка этой
  // конкретной карточки — без сканирования всех `div` на странице и без
  // зависимости от document-order эвристики (`.last()`), которая
  // потребовалась в первой версии этого локатора (див({filter}) матчил всю
  // цепочку предков `.card` вплоть до корня страницы, 10 элементов вместо 1).
  //
  // `.first()` сразу после getByRole('link', ...) — Home.tsx рендерит 4
  // независимо зафетченных рейла (Popular/TrandingSeries/TopAnime/Personal),
  // из которых Popular и Personal не фильтруют по `type`, так что заголовок
  // первой карточки первого рейла в принципе может повториться на другом
  // рейле того же живого API-ответа. Без `.first()` getByRole('link', {name})
  // резолвился бы в 2+ элемента и ловил бы Playwright strict-mode violation
  // на каждом последующем `.locator(...)`/`expect(...)` в цепочке.
  const favoriteButton = page
    .getByRole('link', { name: title, exact: true })
    .first()
    .locator('xpath=../..')
    .getByRole('button', { name: /favorites$/ })

  await expect(favoriteButton).toHaveAccessibleName('Add to favorites')
  await favoriteButton.click()
  await expect(favoriteButton).toHaveAccessibleName('Remove from favorites')

  await page.reload()

  // Тем же комбинированным локатором (по сохранённому title) снова находим
  // favorite-кнопку — доказывает персист через localStorage/
  // kinoshka:favorites, не зависит от того, что рендерится первым после
  // reload.
  await expect(favoriteButton).toHaveAccessibleName('Remove from favorites')

  await checkA11y(page)

  await page.goto('/favorites')

  // Доказывает, что сама страница /favorites реально отображает избранные
  // фильмы, а не только что флаг сохраняется в localStorage. `.first()` для
  // консистентности с локатором выше — на /favorites дубликат маловероятен
  // (рендерятся только избранные фильмы), но на всякий случай.
  await expect(
    page.getByRole('link', { name: title, exact: true }).first(),
  ).toBeVisible()

  await checkA11y(page)
})
