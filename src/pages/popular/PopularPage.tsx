import { useViewport } from '@shared/lib'

import { PopularDesktop } from './ui/PopularDesktop'

export const PopularPage = () => {
  const { isMobile } = useViewport()
  // PopularMobile появится в Task 11 — до тех пор мобильный кейс рендерит null,
  // desktop-путь полностью функционален уже в Task 10.
  return isMobile ? null : <PopularDesktop />
}
