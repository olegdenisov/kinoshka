import type { CastMember } from '@entities/movie'
import { Link } from 'react-router'

import s from './CastTab.module.css'

// В CastMember нет hue (в отличие от Movie) — фиксированный оттенок для градиента-заглушки,
// когда у персоны нет photo, по образцу статичного фолбэка в Poster.tsx (movie.hue ?? 20).
const FALLBACK_HUE = 220

type CastTabProps = {
  cast: CastMember[]
}

export const CastTab = ({ cast }: CastTabProps) => {
  return (
    <div>
      <div className={s.sectionHead}>Cast</div>
      <div className={s.grid}>
        {cast.map(c => {
          const avatar = c.photo ? (
            // alt='' — декоративное фото: доступное имя ссылки уже есть в .actorName,
            // задваивать его через alt не нужно.
            <img className={s.avatar} src={c.photo} alt='' />
          ) : (
            <div
              className={s.avatar}
              style={{
                background: `linear-gradient(145deg, oklch(0.35 0.06 ${FALLBACK_HUE}), oklch(0.15 0.03 ${FALLBACK_HUE + 20}))`,
              }}
            />
          )
          const content = (
            <>
              {avatar}
              <div>
                <div className={s.actorName}>{c.name}</div>
                <div className={s.characterName}>as {c.role}</div>
              </div>
            </>
          )
          // ключ — не просто c.id: Kinopoisk может отдать одну и ту же персону дважды в
          // persons (напр. актёр в двух ролях/дубляже) — id одинаковый, role разная.
          const key = `${c.id}-${c.role}`

          // Обычный <Link>-обёртка, а не stretched-link паттерн из Card: в карточке персоны
          // нет вложенных интерактивных элементов (кнопок-действий), которые пришлось бы
          // выносить DOM-соседями ссылки, — вкладывать их в <a> не пришлось бы, а обособленный
          // ::after поверх карточки тут ничего не даёт.
          // DTO не гарантирует имя персоны (mapDtoToMovieDetail может отдать name: '') — рендерим
          // такую карточку как раньше, обычным <div>, а не <Link> без доступного имени:
          // axe-правило link-name критично и уронило бы checkA11y на живых данных (Задача 14).
          return c.name ? (
            <Link key={key} to={`/person/${c.id}`} className={s.castCard}>
              {content}
            </Link>
          ) : (
            <div key={key} className={s.castCard}>
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
