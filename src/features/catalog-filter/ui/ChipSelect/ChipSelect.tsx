import { useState } from 'react'

import s from './ChipSelect.module.css'

type ChipSelectProps = {
  items: string[]
  /** Шорт-лист; без него показываются все `items` и кнопки «Показать все» нет. */
  defaults?: string[]
  selected: string[]
  getLabel: (value: string) => string
  onToggle: (value: string) => void
  disabled?: boolean
  /**
   * Мобильный размер чипов — явный проп вызывающей стороны (`Search` монтирует ровно один из
   * двух вариантов фильтров), тот же паттерн, что у `ActiveFilterChips`, вместо `@media`.
   */
  compact?: boolean
  /** Статическое имя группы для accessible name кнопки «Показать все»/«Свернуть». */
  groupLabel: string
  /** Поле-фильтр по подстроке в развёрнутом состоянии. */
  searchable?: boolean
}

export const ChipSelect = ({
  items,
  defaults,
  selected,
  getLabel,
  onToggle,
  disabled,
  compact,
  groupLabel,
  searchable,
}: ChipSelectProps) => {
  const [showAll, setShowAll] = useState(false)
  // Текст поиска живёт только в локальном state: не попадает в URL/aria-label/аналитику (sentry.md).
  const [query, setQuery] = useState('')

  const hasDefaults = defaults !== undefined
  const defaultSet = new Set([...(defaults ?? []), ...selected])

  const defaultItems = hasDefaults
    ? items.filter(v => defaultSet.has(v))
    : items
  const restItems = hasDefaults ? items.filter(v => !defaultSet.has(v)) : []

  // Выбранное значение вне `items` (deep-link) всё равно рисуется и подсвечивается. Лейблы
  // доступных значений используются, чтобы не создавать синтетический дубль с тем же текстом
  // (legacy `?genres=Drama` против реального «драма» → тоже «Drama»).
  const availableValues = new Set(items)
  const availableLabels = new Set(items.map(getLabel))
  const missingSelected = selected.filter(
    v => !availableValues.has(v) && !availableLabels.has(getLabel(v)),
  )

  const expanded = showAll || !hasDefaults
  const base = [
    ...defaultItems,
    ...missingSelected,
    ...(showAll ? restItems : []),
  ]

  const needle = query.trim().toLowerCase()
  const showSearch = searchable && expanded
  const visible =
    showSearch && needle
      ? base.filter(
          v =>
            selected.includes(v) ||
            v.toLowerCase().includes(needle) ||
            getLabel(v).toLowerCase().includes(needle),
        )
      : base

  const variant = compact ? s.chipCompact : ''

  return (
    <div className={s.container}>
      {showSearch && (
        <input
          type='search'
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label={`Поиск: ${groupLabel}`}
          disabled={disabled}
          className={`${s.search} ${compact ? s.searchCompact : ''}`}
        />
      )}
      <div className={s.list}>
        {visible.map(value => {
          const active = selected.includes(value)
          return (
            <button
              type='button'
              key={value}
              onClick={() => onToggle(value)}
              disabled={disabled}
              aria-pressed={active}
              className={`${s.chip} ${variant} ${active ? s.chipActive : ''}`}
            >
              {getLabel(value)}
            </button>
          )
        })}
      </div>
      {restItems.length > 0 && (
        <button
          type='button'
          onClick={() => {
            // Поле поиска скрыто в свёрнутом виде — старый текст не должен молча
            // фильтровать список при повторном раскрытии.
            if (showAll) setQuery('')
            setShowAll(!showAll)
          }}
          aria-label={
            showAll
              ? `Свернуть: ${groupLabel}`
              : `Показать все (${restItems.length}): ${groupLabel}`
          }
          className={`${s.toggle} ${compact ? s.toggleCompact : ''}`}
        >
          {showAll ? 'Свернуть' : `Показать все (${restItems.length})`}
        </button>
      )}
    </div>
  )
}
