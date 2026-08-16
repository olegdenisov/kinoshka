import { useViewport } from '@shared/lib'

import { FavoritesDesktop } from './ui/FavoritesDesktop'
import { FavoritesMobile } from './ui/FavoritesMobile'

export const FavoritesPage = () => {
  const { isMobile } = useViewport()
  return isMobile ? <FavoritesMobile /> : <FavoritesDesktop />
}
