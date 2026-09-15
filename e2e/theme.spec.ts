import { expect, test } from '@playwright/test'

import { checkA11y } from './utils/a11y'

test('theme toggle: switches data-theme on <html> and reverts on second click', async ({
  page,
}) => {
  await page.goto('/')

  // Инлайн-скрипт в index.html (анти-FOUC) всегда выставляет data-theme
  // ('light' | 'dark') на <html> до первого рендера — см. AGENTS.md,
  // Theming pattern. Значение по умолчанию зависит от localStorage/OS-темы
  // раннера, поэтому тест не хардкодит исходное значение, а сравнивает его
  // с результатом переключения.
  const html = page.locator('html')
  const initialTheme = await html.getAttribute('data-theme')

  const toggle = page.getByRole('button', {
    name: /switch to (light|dark) theme/i,
  })
  await expect(toggle).toBeVisible()

  await toggle.click()
  await expect(html).not.toHaveAttribute('data-theme', initialTheme ?? '')

  await toggle.click()
  await expect(html).toHaveAttribute('data-theme', initialTheme ?? '')

  await checkA11y(page)
})
