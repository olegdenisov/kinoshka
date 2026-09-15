import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'
import { firstMovieCard } from './utils/movieCard'

test('movie detail: navigate from home, default Overview tab, Cast/Media tabs render', async ({
  page,
}) => {
  await page.goto('/')

  const firstCard = firstMovieCard(page)
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

  // [decision] CastTab.tsx рендерит собственный "Cast" section-head
  // БЕЗУСЛОВНО (даже при пустом cast[] — нет отдельного empty-state UI), а
  // "первый" фильм с главной страницы — неконтролируемые живые данные, не
  // гарантирующие наличие каста (реальный риск флейка на живом API, не
  // гипотетический). MovieTabsNav's собственная кнопка "Cast" содержит тот
  // же текст и остаётся смонтированной над контентом таба, поэтому
  // реальное появление контента CastTab доказывается изменением COUNT
  // совпадений "Cast" с 1 (только кнопка) до 2 (кнопка + section-head), а
  // не наличием конкретной карточки актёра.
  await expect(page.getByText('Cast', { exact: true })).toHaveCount(2)

  // Бонусная, не блокирующая проверка: если у этого конкретного фильма
  // каст всё-таки есть, дополнительно проверяем форму карточки — но никогда
  // не предполагаем, что он обязан быть.
  const castMember = page.getByText(/^as /).first()
  if ((await castMember.count()) > 0) {
    await expect(castMember).toBeVisible()
  }

  await page.getByRole('button', { name: 'Media' }).click()

  // [decision] У MediaTab нет отдельного UI для "нет трейлера/скриншотов" —
  // если у фильма нет ни того, ни другого, таб рендерит пустой контейнер без
  // текста. Поэтому детерминированная проверка переключения — что
  // section-head CastTab исчез (COUNT "Cast" вернулся к 1, только кнопка),
  // без зависимости от наличия конкретных данных каста; секции Trailer/
  // Screenshots проверяются дополнительно только если они присутствуют.
  await expect(page.getByText('Cast', { exact: true })).toHaveCount(1)

  const mediaContent = page
    .getByText('Trailer', { exact: true })
    .or(page.getByText('Screenshots', { exact: true }))
  if ((await mediaContent.count()) > 0) {
    await expect(mediaContent.first()).toBeVisible()
  }
})

test('movie detail: unknown id renders the not-found ErrorState', async ({
  page,
}) => {
  // Единственный тест на error/404-путь во всём сьюте — AGENTS.md
  // документирует ApiError + AsyncBoundary.errorFallback как переиспользуемый
  // паттерн (MoviePage.tsx: 'Movie not found' ErrorState с рабочим Retry), но
  // до этого ни один e2e-спек не проверял его в реальном браузере. Стоит
  // максимум 1 доп. запрос к живому API (сам 404-ответ) — дёшево относительно
  // бюджета ~40-50 запросов на полный прогон (см. Context плана). Retry не
  // кликаем намеренно — это удвоило бы стоимость сценария ещё одним
  // 404-запросом без прироста покрытия сверх того, что уже проверено самим
  // фактом рендера ErrorState.
  // [decision] `9999999` (7 девяток) эмпирически подтверждён как реально
  // 404-ящий id через живой API (curl против /v1.5/movie/9999999 -> 404) —
  // более длинные числа (9-10 девяток) 400-ят как Bad Request (валидация
  // формата id), а не 404 (movieErrorFallback показывает "Something went
  // wrong"/generic fallback только для 400, не "Movie not found").
  await page.goto('/movie/9999999')

  await expect(page.getByText('Movie not found', { exact: true })).toBeVisible()
  await expect(
    page.getByText("This movie doesn't exist or was removed.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Попробовать снова' }),
  ).toBeVisible()

  await checkA11y(page)
})
