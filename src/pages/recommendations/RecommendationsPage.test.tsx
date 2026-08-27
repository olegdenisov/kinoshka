import { render, screen } from '@testing-library/react'

import { RecommendationsPage } from './RecommendationsPage'

// RecommendationsPage.tsx больше не выбирает между Desktop/Mobile вариантами (слияние —
// docs/plans/20260827-mobile-first-adaptive-layout.md, Task 5): раньше этот файл мокал
// useViewport() и проверял переключение RecommendationsDesktop/RecommendationsMobile — этой
// развилки больше нет, `RecommendationsPage` — тривиальная обёртка над единым `Recommendations`.
// Мокаем сам `Recommendations`, чтобы проверять только факт делегирования (page-level
// поведение), а не переиспытывать его собственную, отдельно протестированную логику
// (Recommendations.test.tsx).
vi.mock('./ui/Recommendations', () => ({
  Recommendations: () => <div>Recommendations stub</div>,
}))

describe('RecommendationsPage', () => {
  it('рендерит единый Recommendations без выбора варианта', () => {
    render(<RecommendationsPage />)

    expect(screen.getByText('Recommendations stub')).toBeInTheDocument()
  })
})
