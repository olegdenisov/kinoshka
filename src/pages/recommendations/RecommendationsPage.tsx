import { useViewport } from '@shared/lib'

import { RecommendationsDesktop } from './ui/RecommendationsDesktop'
import { RecommendationsMobile } from './ui/RecommendationsMobile'

export const RecommendationsPage = () => {
  const { isMobile } = useViewport()
  return isMobile ? <RecommendationsMobile /> : <RecommendationsDesktop />
}
