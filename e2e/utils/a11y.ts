import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Ассерт «нет violations с impact === 'critical'» (roadmap: «нет critical
// violations», не «ноль violations вообще» — сторонний Google Fonts и т.п.
// не должны ронять тест minor/moderate шумом). Сообщение об ошибке сразу
// содержит id правил, упавших с impact critical — см.
// docs/plans/20260912-e2e-playwright-axe.md, Technical Details.
export const checkA11y = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze()
  const critical = results.violations.filter(v => v.impact === 'critical')

  expect(critical, JSON.stringify(critical.map(v => v.id))).toEqual([])
}
