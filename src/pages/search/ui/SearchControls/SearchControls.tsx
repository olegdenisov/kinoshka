import { ActiveFilterChips } from '@features/catalog-filter'
import type { FilterChip } from '@features/catalog-filter'

import { SortSelect } from '../SortSelect'

import s from './SearchControls.module.css'

type SearchControlsProps = {
  chips: FilterChip[]
  onRemoveChip: (id: string) => void
  onClearAll: () => void
  sort: string
  onSortChange: (v: string) => void
  sortDisabled?: boolean
}

export const SearchControls = ({
  chips,
  onRemoveChip,
  onClearAll,
  sort,
  onSortChange,
  sortDisabled,
}: SearchControlsProps) => {
  return (
    <div className={s.row}>
      <ActiveFilterChips
        chips={chips}
        onRemove={onRemoveChip}
        onClearAll={onClearAll}
      />
      <SortSelect
        value={sort}
        onChange={onSortChange}
        disabled={sortDisabled}
      />
    </div>
  )
}
