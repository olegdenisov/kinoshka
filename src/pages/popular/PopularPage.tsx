import { useViewport } from '@shared/lib'

import { PopularDesktop } from './ui/PopularDesktop'
import { PopularMobile } from './ui/PopularMobile'

export const PopularPage = () => {
  const { isMobile } = useViewport()
  return isMobile ? <PopularMobile /> : <PopularDesktop />
}
