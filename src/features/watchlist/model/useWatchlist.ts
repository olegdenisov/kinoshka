import { useDispatch, useSelector } from 'react-redux'

import { selectWatchlistIds, watchlistToggled } from './watchlistSlice'
import type { WatchlistRootState } from './watchlistSlice'

export const useWatchlist = () => {
  const ids = useSelector((state: WatchlistRootState) =>
    selectWatchlistIds(state),
  )
  const dispatch = useDispatch()

  return {
    ids,
    isInWatchlist: (id: number) => ids.includes(id),
    // При недоступном хранилище persist откатит стейт синхронно — состояние остаётся прежним.
    toggle: (id: number) => {
      dispatch(watchlistToggled(id))
    },
  }
}
