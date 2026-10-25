import { useWatchedStore } from './watchedStore'

export const useWatched = () => {
  const ids = useWatchedStore(state => state.ids)
  const toggle = useWatchedStore(state => state.toggle)

  return {
    ids,
    isWatched: (id: number) => ids.includes(id),
    toggle,
  }
}
