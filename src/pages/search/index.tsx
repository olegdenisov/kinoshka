import { useViewport } from '../../shared/lib/useViewport'
import { SearchDesktop } from './ui/SearchDesktop'
import { SearchMobile } from './ui/SearchMobile'

export function SearchPage() {
  const { isMobile } = useViewport()
  return isMobile ? <SearchMobile /> : <SearchDesktop />
}
