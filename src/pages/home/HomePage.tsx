import { useViewport } from '../../shared/lib/useViewport'
import { HomeDesktop } from './ui/HomeDesktop'
import { HomeMobile } from './ui/HomeMobile'

export const HomePage = () => {
  const { isMobile } = useViewport()
  return isMobile ? <HomeMobile /> : <HomeDesktop />
}
