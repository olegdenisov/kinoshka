import type * as SharedLib from '@shared/lib'
import { useViewport } from '@shared/lib'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RecommendationsPage } from './RecommendationsPage'

// Смоук-тест переключателя Desktop/Mobile (паттерн PopularPage.tsx) — мокаем
// useViewport и сами Desktop/Mobile UI-компоненты (у них своя, отдельно
// протестированная логика в RecommendationsDesktop.test.tsx/
// RecommendationsMobile.test.tsx), чтобы проверять только факт переключения,
// без сети/Suspense/localStorage.
vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return {
    ...actual,
    useViewport: vi.fn(),
  }
})

vi.mock('./ui/RecommendationsDesktop', () => ({
  RecommendationsDesktop: () => <div>Recommendations Desktop stub</div>,
}))

vi.mock('./ui/RecommendationsMobile', () => ({
  RecommendationsMobile: () => <div>Recommendations Mobile stub</div>,
}))

const mockUseViewport = vi.mocked(useViewport)

describe('RecommendationsPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('рендерит RecommendationsDesktop, когда useViewport().isMobile === false', () => {
    mockUseViewport.mockReturnValue({ isMobile: false })

    render(<RecommendationsPage />)

    expect(screen.getByText('Recommendations Desktop stub')).toBeInTheDocument()
    expect(
      screen.queryByText('Recommendations Mobile stub'),
    ).not.toBeInTheDocument()
  })

  it('рендерит RecommendationsMobile, когда useViewport().isMobile === true', () => {
    mockUseViewport.mockReturnValue({ isMobile: true })

    render(<RecommendationsPage />)

    expect(screen.getByText('Recommendations Mobile stub')).toBeInTheDocument()
    expect(
      screen.queryByText('Recommendations Desktop stub'),
    ).not.toBeInTheDocument()
  })
})
