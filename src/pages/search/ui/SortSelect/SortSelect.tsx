import { useState } from 'react'
import { SORT_LABELS } from '@features/catalog-filter'
import { ChevronDownIcon, CheckIcon } from '@shared/ui'
import s from './SortSelect.module.css'

type SortSelectProps = {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

/**
 * Интерактивный dropdown сортировки. Опции — `SORT_LABELS` (`@features/catalog-filter`,
 * тот же источник, что `filtersToParams` использует для маппинга лейбл→sortField/sortType) —
 * единый список, без дублирования между desktop/mobile.
 */
export const SortSelect = ({ value, onChange, disabled }: SortSelectProps) => {
  const [open, setOpen] = useState(false)

  const handleSelect = (option: string) => {
    onChange(option)
    setOpen(false)
  }

  return (
    <div className={s.wrapper}>
      <button
        type='button'
        className={s.trigger}
        onClick={() => setOpen(prev => !prev)}
        disabled={disabled}
        aria-haspopup='listbox'
        aria-expanded={open}
      >
        <span className={s.label}>Sort</span>
        <span>{value || 'Default'}</span>
        <ChevronDownIcon />
      </button>
      {open && !disabled && (
        <ul className={s.menu} role='listbox'>
          {SORT_LABELS.map(option => (
            <li key={option}>
              <button
                type='button'
                role='option'
                aria-selected={value === option}
                className={`${s.option} ${value === option ? s.active : ''}`}
                onClick={() => handleSelect(option)}
              >
                {option}
                {value === option && <CheckIcon size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
