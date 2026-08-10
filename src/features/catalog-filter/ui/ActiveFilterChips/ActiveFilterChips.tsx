import type { ActiveChip } from "../../model/useFilterState"
import { CloseIcon } from "@shared/ui"
import s from "./ActiveFilterChips.module.css"

type ActiveFilterChipsProps = {
  chips: ActiveChip[]
  onClearAll?: () => void
  compact?: boolean
}

export const ActiveFilterChips = ({
  chips,
  onClearAll,
  compact = false,
}: ActiveFilterChipsProps) => {
  if (compact) {
    return (
      <>
        {chips.slice(0, 6).map((c, i) => (
          <span key={i} className={s.chipCompact}>
            {c.label}
            <button onClick={c.onRemove} className={s.chipCompactRemove}>
              <CloseIcon size={8} />
            </button>
          </span>
        ))}
      </>
    )
  }

  return (
    <div className={s.container}>
      {chips.map((c, i) => (
        <span key={i} className={s.chip}>
          {c.label}
          <button onClick={c.onRemove} className={s.chipRemove}>
            <CloseIcon size={10} />
          </button>
        </span>
      ))}
      {chips.length > 0 && onClearAll && (
        <button onClick={onClearAll} className={s.clearAll}>
          Clear all
        </button>
      )}
    </div>
  )
}
