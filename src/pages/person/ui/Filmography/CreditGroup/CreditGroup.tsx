import { paths } from '@shared/config'
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
        {visible.map((credit, index) => (
          // Kinopoisk может отдать один и тот же фильм дважды в одном бакете
          // groupCreditsByProfession (несколько ролей у одного enProfession,
          // например разные персонажи или producer + executive producer под
          // одной меткой) — тогда (id, profession) не уникальна сама по себе.
          // Индекс внутри видимого среза — надёжный тай-брейк; profession
          // остаётся для параллели с составным ключом в CastTab.tsx.
          <li
            key={`${credit.id}-${credit.profession ?? ''}-${index}`}
            className={s.item}
          >
            <Link to={paths.movie(credit.id)} className={s.link}>
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
