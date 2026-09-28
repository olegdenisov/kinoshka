import { useId, useState } from 'react'
import { Link } from 'react-router'

import type { CreditGroupData } from '../../../lib/groupCreditsByProfession'

import s from './CreditGroup.module.css'

// Порог сворачивания: у активных актёров 90+ кредитов — полный список сразу
// превращает страницу в бесконечную простыню.
const VISIBLE_CREDITS = 12

type CreditGroupProps = {
  group: CreditGroupData
}

// Состояние разворота — per-группа (свой useState), а не одно булево на всю
// Filmography: иначе «Show all» в одной группе разворачивал бы все остальные.
export const CreditGroup = ({ group }: CreditGroupProps) => {
  const [expanded, setExpanded] = useState(false)
  const headingId = useId()
  const listId = useId()

  const { label, credits } = group
  const hasMore = credits.length > VISIBLE_CREDITS
  const visible = expanded ? credits : credits.slice(0, VISIBLE_CREDITS)
  // label группы в тексте кнопки — чтобы у двух групп с одинаковым числом
  // кредитов не совпали доступные имена кнопок (см. a11y-baseline в AGENTS.md).
  const labelLower = label.toLowerCase()
  const toggleText = expanded
    ? `Show fewer ${labelLower} credits`
    : `Show all ${credits.length} ${labelLower} credits`

  return (
    <section className={s.group} aria-labelledby={headingId}>
      <h3 id={headingId} className={s.groupHead}>
        {label} <span className={s.count}>{credits.length}</span>
      </h3>
      <ul id={listId} className={s.list}>
        {visible.map(credit => (
          // Составной ключ по прецеденту `${c.id}-${c.role}` в CastTab.tsx:
          // внутри одного бакета groupCreditsByProfession профессия уже
          // постоянна и id сам по себе уникален, суффикс — задел на случай,
          // если список когда-нибудь станет рендериться без группировки.
          <li
            key={`${credit.id}-${credit.profession ?? ''}`}
            className={s.item}
          >
            <Link to={`/movie/${credit.id}`} className={s.link}>
              {credit.title}
            </Link>
            {credit.role && <span className={s.role}>{credit.role}</span>}
            {/* != null, а не truthy: рейтинг 0 у непроголосованных фильмов — реальное значение */}
            {credit.rating != null && (
              <span className={s.rating}>{credit.rating.toFixed(1)}</span>
            )}
          </li>
        ))}
      </ul>
      {hasMore && (
        // Кнопка не исчезает после разворота, а переключается в «Show fewer»:
        // иначе фокус с удалённой кнопки улетел бы в body.
        <button
          type='button'
          className={s.toggle}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded(prev => !prev)}
        >
          {toggleText}
        </button>
      )}
    </section>
  )
}
