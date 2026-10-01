import { useDispatch, useSelector } from 'react-redux'

import { selectWatchedIds, watchedToggled } from './watchedSlice'
import type { WatchedRootState } from './watchedSlice'

export const useWatched = () => {
  const ids = useSelector((state: WatchedRootState) => selectWatchedIds(state))
  const dispatch = useDispatch()

  return {
    ids,
    isWatched: (id: number) => ids.includes(id),
    // При недоступном хранилище persist откатит стейт синхронно — состояние остаётся прежним.
    toggle: (id: number) => {
      dispatch(watchedToggled(id))
    },
  }
}
