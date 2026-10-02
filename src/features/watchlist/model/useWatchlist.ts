import { useWatchlistStore } from './watchlistStore'

export const useWatchlist = () => {
  const ids = useWatchlistStore(state => state.ids)
  const toggle = useWatchlistStore(state => state.toggle)

  return {
    ids,
    isInWatchlist: (id: number) => ids.includes(id),
    toggle,
  }
}
