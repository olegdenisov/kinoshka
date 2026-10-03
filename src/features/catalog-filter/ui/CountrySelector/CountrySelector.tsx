import { countries, STATIC_FALLBACK_COUNTRIES } from '@entities/movie'
import { reatomComponent } from '@reatom/react'

import { getCountryLabel } from '../../lib/filterOptions'
import { ChipSelect } from '../ChipSelect'

type CountrySelectorProps = {
  selected: string[]
  onToggle: (name: string) => void
  disabled?: boolean
  compact?: boolean
}

/** Словарь без Suspense: шорт-лист виден сразу, полный список подменяется фоном. */
export const CountrySelector = reatomComponent(
  ({ selected, onToggle, disabled, compact }: CountrySelectorProps) => (
    <ChipSelect
      items={countries()}
      defaults={STATIC_FALLBACK_COUNTRIES}
      selected={selected}
      getLabel={getCountryLabel}
      onToggle={onToggle}
      disabled={disabled}
      compact={compact}
      groupLabel='Country'
      searchable
    />
  ),
  'CountrySelector',
)
