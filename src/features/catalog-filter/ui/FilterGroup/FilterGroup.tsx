import { type PropsWithChildren, useState } from 'react'

import s from './FilterGroup.module.css'

type FilterGroupProps = PropsWithChildren<{
  title: string
  /** Счётчик активных значений в группе; при 0 не показывается. */
  count?: number
  defaultOpen?: boolean
  /** Мобильный размер — явный проп вызывающей стороны, как у `ChipSelect`. */
  compact?: boolean
}>

export const FilterGroup = ({
  title,
  count = 0,
  defaultOpen = false,
  compact,
  children,
}: FilterGroupProps) => {
  // `open` живёт в локальном state и не привязан к `defaultOpen` после монтирования:
  // `FilterPanel` пересчитывает `defaultOpen` из `filters` на каждом рендере, и снятие
  // последнего чипа иначе схлопнуло бы группу под рукой пользователя.
  const [open, setOpen] = useState(defaultOpen)
  // Дети не рендерим до первого раскрытия: словарь стран не должен тратить квоту API,
  // пока группа закрыта.
  const [everOpened, setEverOpened] = useState(defaultOpen)

  return (
    <details
      className={`${s.group} ${compact ? s.groupCompact : ''}`}
      open={open}
      onToggle={e => {
        const next = e.currentTarget.open
        setOpen(next)
        if (next) setEverOpened(true)
      }}
    >
      <summary className={s.summary}>
        <span className={s.title}>{title}</span>
        {count > 0 && <span className={s.count}>{count}</span>}
        <span className={s.marker} aria-hidden='true' />
      </summary>
      {everOpened && <div className={s.body}>{children}</div>}
    </details>
  )
}
