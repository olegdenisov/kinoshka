import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'

// /profile — client-only страница: имя лежит в localStorage (kinoshka:profile), запросов к API
// она не делает вовсе, поэтому спека не расходует дневную квоту демо-тарифа. Клик по
// «Favorites» — клиентская навигация на /favorites; при пустом избранном та не ходит в API
// (Recommendations/Favorites коротко замыкаются на ids.length === 0).
test('profile: name persists after reload, header avatar shows initials, quick access navigates', async ({
  page,
}) => {
  await page.goto('/profile')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Profile' }),
  ).toBeVisible()

  const nameInput = page.getByLabel('Display name')
  const saveBtn = page.getByRole('button', { name: 'Save' })

  // Пока имя не изменено, Save задизейблен.
  await expect(saveBtn).toBeDisabled()

  await nameInput.fill('Ada Lovelace')
  await expect(saveBtn).toBeEnabled()
  await saveBtn.click()

  // Аватар в шапке — ссылка на /profile, aria-label включает имя, а видимый текст — инициалы.
  const headerAvatar = page.getByRole('link', {
    name: 'Your profile: Ada Lovelace',
  })
  await expect(headerAvatar).toHaveText('AL')
  await expect(headerAvatar).toHaveAttribute('href', '/profile')

  // Реальный персист через localStorage, а не только React-стейт.
  await page.reload()

  await expect(nameInput).toHaveValue('Ada Lovelace')
  await expect(
    page.getByRole('link', { name: 'Your profile: Ada Lovelace' }),
  ).toHaveText('AL')

  await checkA11y(page)

  // Скоуп к секции «Quick access»: голый getByRole('link', { name: 'Favorites' }) мог бы
  // зацепить и другие ссылки с таким же именем (например, в шапке/футере).
  await page
    .getByRole('region', { name: 'Quick access' })
    .getByRole('link', { name: /^Favorites/ })
    .click()

  await expect(page).toHaveURL(/\/favorites$/)
})
