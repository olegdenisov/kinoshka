import { ChevronDownIcon } from '@shared/ui'
import s from './SortSelect.module.css'

type SortSelectProps = {
  value: string
  onChange: (v: string) => void
}

export function SortSelect({ value }: SortSelectProps) {
  return (
    <div className={s.wrapper}>
      <span className={s.label}>Sort</span>
      <span>{value}</span>
      <ChevronDownIcon />
    </div>
  )
}
