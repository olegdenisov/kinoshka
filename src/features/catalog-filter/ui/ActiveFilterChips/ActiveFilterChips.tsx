import { CloseIcon } from '@shared/ui'

import type { ActiveChip } from '../../model/useFilterState'

import s from './ActiveFilterChips.module.css'

type ActiveFilterChipsProps = {
  chips: ActiveChip[]
  onClearAll?: () => void
  /**
   * При `true` рендерит полностью другое DOM-поддерево (`chipCompact`/`chipCompactRemove`, без
   * `Clear all`), а не просто другой CSS-класс поверх того же разметки — тот же механизм, что и
   * `compact` у `GenreSelector` (`@features/catalog-filter/ui`, см. его докблок для полного
   * обоснования).
   *
   * **Инвариант (Task 10, план `docs/plans/20260827-mobile-first-adaptive-layout.md`): рендерится
   * только в одном из двух активных вариантов фильтров единого `Search` одновременно** — обычный
   * (`compact` не передан/`false`) внутри desktop-варианта `SearchControls` рядом с
   * `SearchSidebar`, компактный (`compact={true}`) внутри мобильного sticky filter-bar рядом с
   * bottom-sheet фильтрами. `Search` монтирует ровно один из двух вариантов фильтров за раз
   * (точечный `useViewport()`, см. `GenreSelector`'s докблок и Task 1/Audit) — `compact` остаётся
   * явным JS-параметром от вызывающей стороны, а не выводится из `@media`/ширины экрана, потому
   * что оба варианта технически МОГУТ существовать в одном React-дереве (просто не одновременно
   * смонтированы), и то, какой из них активен, знает только `Search`.
   */
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
            <button
              type='button'
              onClick={c.onRemove}
              className={s.chipCompactRemove}
            >
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
          <button type='button' onClick={c.onRemove} className={s.chipRemove}>
            <CloseIcon size={10} />
          </button>
        </span>
      ))}
      {chips.length > 0 && onClearAll && (
        <button type='button' onClick={onClearAll} className={s.clearAll}>
          Clear all
        </button>
      )}
    </div>
  )
}
