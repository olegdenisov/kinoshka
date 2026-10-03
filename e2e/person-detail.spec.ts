import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'

// [decision] `666` — тот же фильм, что уже "live-verified" в
// .github/workflows/lighthouse.yml (там он используется для замера heavy
// detail-страницы). Живой запрос `GET /v1.5/movie/666` при подготовке этой
// задачи подтвердил: 88 persons, из них 50 c enProfession === 'actor', все с
// непустым name — гарантированно непустой Cast-таб, без риска флейка на
// "первой карточке с главной", где живые данные не гарантируют наличие каста
// (см. movie-detail.spec.ts).
const MOVIE_ID_WITH_CAST = 666

test('person detail: navigate from movie Cast tab, filmography required, facts optional, a11y clean', async ({
  page,
}) => {
  await page.goto(`/movie/${MOVIE_ID_WITH_CAST}`)

  await page.getByRole('button', { name: 'Cast' }).click()

  // Селектор по href-паттерну — аналог firstMovieCard()
  // (a[href^="/movie/"]) из e2e/utils/movieCard.ts, оправдан тем же образом:
  // голый getByRole('link').first() рискует зацепить не ту ссылку на странице.
  const firstCastLink = page.locator('a[href^="/person/"]').first()
  await expect(firstCastLink).toBeVisible()
  await firstCastLink.click()

  await expect(page).toHaveURL(/\/person\/.+/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Filmography.tsx рендерит заголовок <h2>Filmography</h2> безусловно (пустой
  // список подменяет только тело секции на EmptyState) — проверяем жёстко.
  await expect(
    page.getByRole('heading', { level: 2, name: 'Filmography' }),
  ).toBeVisible()

  // Мягкая проверка: PersonFacts возвращает null при пустых facts[]
  // (см. PersonFacts.tsx) — у произвольной персоны из каста факты могут
  // отсутствовать, не блокируем тест.
  const factsHeading = page.getByRole('heading', { level: 2, name: 'Facts' })
  if ((await factsHeading.count()) > 0) {
    await expect(factsHeading).toBeVisible()
  }

  // A11y-проверка один раз на успешной странице персоны — экономим квоту
  // живого API, по прецеденту movie-detail.spec.ts/profile.spec.ts.
  await checkA11y(page)
})

test('person detail: unknown id renders the not-found ErrorState', async ({
  page,
}) => {
  // [decision] `9999999` подтверждён живым curl-запросом к
  // /v1.5/person/9999999 -> 404 ("По этому id ничего не найдено!"), не 400 —
  // тот же id, что уже используется как заведомо 404-ящий для /movie/9999999
  // в movie-detail.spec.ts, здесь дополнительно перепроверен именно для
  // /v1.5/person/, т.к. план явно требует не полагаться на аналогию с movie.
  await page.goto('/person/9999999')

  await expect(
    page.getByText('Person not found', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("This person doesn't exist or was removed.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Попробовать снова' }),
  ).toBeVisible()

  await checkA11y(page)
})
