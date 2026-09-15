import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'

test('favorites: add on home, persists after reload, appears on /favorites', async ({
  page,
}) => {
  await page.goto('/')

  // Стабильный селектор карточки фильма — по href-паттерну react-router
  // (/movie/:id), не голый getByRole('link').first(). См. Technical Details
  // в плане.
  const firstCard = page.locator('a[href^="/movie/"]').first()
  await expect(firstCard).toBeVisible()

  // Рейлы рендерятся в фиксированном DOM-порядке (Home.tsx), но четыре
  // Suspense-границы резолвятся независимо, поэтому карточка идентифицируется
  // по названию (title), а не по голой позиции после reload.
  const title = await firstCard.textContent()
  if (!title) {
    throw new Error('First movie card on / has no title text')
  }

  // Скоуп favorite-кнопки к конкретной карточке через комбинированный
  // filter({ has }) — title-Link живёт в .info, favorite-кнопка — в
  // соседнем .posterContainer, оба — прямые дети общего .card-узла. См.
  // Technical Details в плане для полного обоснования этого паттерна.
  //
  // [decision] `filter({ has })` матчит не только `.card`, а весь цепочки
  // предков этого div вплоть до корня страницы — каждый из них тоже
  // "содержит" и конкретную ссылку, и (какую-нибудь) favorite-кнопку среди
  // потомков. Эмпирически (strict-mode violation, resolved to 10 elements)
  // подтверждено, что без `.last()` итоговый локатор резолвится во ВСЕ
  // favorite-кнопки на странице, а не только в кнопку этой карточки.
  // `.last()` берёт самый глубоко вложенный из совпавших div — то есть
  // именно `.card` — поскольку document order перечисляет предков раньше
  // потомков.
  const favoriteButton = page
    .locator('div')
    .filter({ has: page.getByRole('link', { name: title, exact: true }) })
    .filter({ has: page.getByRole('button', { name: /favorites$/ }) })
    .last()
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
  // фильмы, а не только что флаг сохраняется в localStorage.
  await expect(
    page.getByRole('link', { name: title, exact: true }),
  ).toBeVisible()

  await checkA11y(page)
})
