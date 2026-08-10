import { useViewport } from "../../shared/lib/viewport/useViewport"
import { SearchDesktop } from "./ui/SearchDesktop"
import { SearchMobile } from "./ui/SearchMobile"

export const SearchPage = () => {
  const { isMobile } = useViewport()
  return isMobile ? <SearchMobile /> : <SearchDesktop />
}
