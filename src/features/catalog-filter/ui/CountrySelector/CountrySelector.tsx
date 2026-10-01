import {
  STATIC_FALLBACK_COUNTRIES,
  useCountryDictionary,
} from '@entities/movie'

import { getCountryLabel } from '../../lib/filterOptions'
import { ChipSelect } from '../ChipSelect'

type CountrySelectorProps = {
  selected: string[]
  onToggle: (name: string) => void
  disabled?: boolean
  compact?: boolean
}

/** Синхронный хук словаря без Suspense: шорт-лист виден сразу, полный список подменяется фоном. */
export const CountrySelector = ({
  selected,
  onToggle,
  disabled,
  compact,
}: CountrySelectorProps) => {
  const countries = useCountryDictionary()

  return (
    <ChipSelect
      items={countries}
      defaults={STATIC_FALLBACK_COUNTRIES}
      selected={selected}
      getLabel={getCountryLabel}
      onToggle={onToggle}
      disabled={disabled}
      compact={compact}
      groupLabel='Country'
      searchable
    />
  )
}
