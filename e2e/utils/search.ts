import type { Locator, Page } from '@playwright/test'

// Либо результаты нашлись (счётчик "N shown · page X of Y" в Search.tsx), либо
// показан EmptyState 'Nothing found' — оба исхода подтверждают, что грид
// действительно завершил перерендер по новым параметрам (не завис в loading).
export const resultsOrEmptyState = (page: Page): Locator =>
  page.getByText(/shown · page \d+ of \d+/).or(page.getByText('Nothing found'))
