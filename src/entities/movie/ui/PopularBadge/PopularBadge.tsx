import s from './PopularBadge.module.css'

type PopularBadgeProps = {
  position: number
  positionDiff?: number | null
}

// Направление positionDiff (рост vs падение при положительном значении) не
// задокументировано в OpenAPI-спеке и не проверено на исторических данных —
// см. Technical Details в docs/plans/20260825-popular-this-week-rail.md.
// Поэтому рендерим знаковое число как есть, без интерпретирующей стрелки/цвета.
const formatDiff = (diff: number) =>
  diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`

export const PopularBadge = ({ position, positionDiff }: PopularBadgeProps) => {
  const hasDiff = typeof positionDiff === 'number' && positionDiff !== 0

  const label = hasDiff
    ? `Position ${position}, change ${formatDiff(positionDiff as number)}`
    : `Position ${position}`

  return (
    <div className={s.badge} role='img' aria-label={label}>
      <span>#{position}</span>
      {hasDiff && (
        <span className={s.diff}>{formatDiff(positionDiff as number)}</span>
      )}
    </div>
  )
}
