import { useSyncExternalStore } from 'react'
import type { StorageSlot } from './storage'

export const useStorageSlot = <T>(
  slot: StorageSlot<T>,
): [T, (value: T) => void] => {
  const value = useSyncExternalStore(slot.subscribe, slot.get)

  return [value, slot.set]
}
