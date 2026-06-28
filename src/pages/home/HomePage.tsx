import { useViewport } from '../../shared/lib/viewport/useViewport'
import { HomeDesktop } from './ui/HomeDesktop'
import { HomeMobile } from './ui/HomeMobile'

export const HomePage = () => {
  const { isMobile } = useViewport()
  return isMobile ? <HomeMobile /> : <HomeDesktop />
}
