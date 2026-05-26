import { ActiveFilterChips } from '@features/catalog-filter'
import type { ActiveChip } from '@features/catalog-filter'
import { SortSelect } from '../SortSelect'
import s from './SearchControls.module.css'

type SearchControlsProps = {
  chips: ActiveChip[]
  onClearAll: () => void
  sort: string
  onSortChange: (v: string) => void
}

export function SearchControls({ chips, onClearAll, sort, onSortChange }: SearchControlsProps) {
  return (
    <div className={s.row}>
      <ActiveFilterChips chips={chips} onClearAll={onClearAll} />
      <SortSelect value={sort} onChange={onSortChange} />
    </div>
  )
}
