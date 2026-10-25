import { getInitials } from '../lib/getInitials'
import { useProfileStore } from './profileStore'

type UseProfileResult = {
  name: string
  initials: string
  setName: (next: string) => boolean
  clearName: () => boolean
}

export const useProfile = (): UseProfileResult => {
  const name = useProfileStore(state => state.name)
  const setName = useProfileStore(state => state.setName)
  const clearName = useProfileStore(state => state.clearName)

  return { name, initials: getInitials(name), setName, clearName }
}
