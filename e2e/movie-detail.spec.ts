import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'

test('movie detail: navigate from home, default Overview tab, Cast/Media tabs render', async ({
  page,
}) => {
  await page.goto('/')

  // Стабильный селектор карточки фильма — по href-паттерну react-router
  // (/movie/:id), не голый getByRole('link').first(), который резолвится в
  // логотип шапки. См. Technical Details в плане.
  const firstCard = page.locator('a[href^="/movie/"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()

  await expect(page).toHaveURL(/\/movie\/.+/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Overview — таб по умолчанию (Movie.tsx: useState('Overview')). 'Synopsis' —
  // текст section-head'а именно OverviewTab (MovieHero тоже рендерит synopsis,
  // но без этого лейбла), поэтому уникально подтверждает контент дефолтного таба.
  await expect(page.getByText('Synopsis', { exact: true })).toBeVisible()

  // A11y-проверка один раз после первичной загрузки, не на каждом табе —
  // экономим квоту живого API (см. Technical Details/Context в плане).
  await checkA11y(page)

  await page.getByRole('button', { name: 'Cast' }).click()

  // Каждая карточка CastTab рендерит "as {role}" под именем актёра — паттерн
  // уникален для CastTab (в отличие от текста "Cast" самой кнопки таба).
  await expect(page.getByText(/^as /).first()).toBeVisible()

  await page.getByRole('button', { name: 'Media' }).click()

  // [decision] У MediaTab нет отдельного UI для "нет трейлера/скриншотов" —
  // если у фильма нет ни того, ни другого, таб рендерит пустой контейнер без
  // текста. Поэтому детерминированная проверка — что контент предыдущего
  // (Cast) таба исчез, доказывая реальное переключение; секции Trailer/
  // Screenshots проверяются дополнительно только если они присутствуют.
  await expect(page.getByText(/^as /).first()).not.toBeVisible()

  const mediaContent = page
    .getByText('Trailer', { exact: true })
    .or(page.getByText('Screenshots', { exact: true }))
  if ((await mediaContent.count()) > 0) {
    await expect(mediaContent.first()).toBeVisible()
  }
})
