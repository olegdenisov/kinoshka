import type { Genre } from '@entities/movie'
import { STATIC_FALLBACK_GENRES, useGenreDictionary } from '@entities/movie'
import { useState } from 'react'

import { getGenreLabel } from '../../lib/genreMap'

import s from './GenreSelector.module.css'

type GenreSelectorProps = {
  selected: string[]
  onToggle: (name: string) => void
  disabled?: boolean
  /**
   * Мобильный размер чипов (34px/pill-радиус вместо desktop 28px/4px), передаётся вызывающей
   * стороной явно — тот же паттерн variant-класса, что и у `ActiveFilterChips`'s `compact`,
   * вместо `@media` внутри собственного CSS-модуля.
   *
   * **Инвариант после Task 10 (слияние `SearchDesktop`/`SearchMobile` в единый `Search`,
   * план `docs/plans/20260827-mobile-first-adaptive-layout.md`): не "рендерится только на одном
   * брейкпоинте" (это было верно только пока `useViewport` выбирал между двумя отдельными
   * *странице*-компонентами), а "рендерится только в одном из двух активных вариантов фильтров
   * одновременно".** Единый `Search` по-прежнему монтирует ровно один вариант фильтров за раз —
   * `SearchSidebar` (десктоп, `compact` не передаётся/`false`) **или** bottom-sheet
   * (мобильный, `compact` передаётся `true`) — но выбор между ними теперь точечный
   * `useViewport()` внутри самого `Search`, а не ветвление на уровне `*Page.tsx` (см. Task 1/
   * Audit — sidebar/bottom-sheet остался одним из немногих оправданных мест для `useViewport()`
   * после рефакторинга, ровно из-за этой пары компонентов). Проп остаётся явным JS-параметром,
   * управляемым вызывающей стороной (`Search`), а не выводится из `@media`/ширины экрана —
   * потому что оба варианта фильтров технически МОГУТ существовать в одном React-дереве (просто
   * не одновременно смонтированы), и то, какой из них активен сейчас, знает только `Search`, не
   * сам `GenreSelector`.
   */
  compact?: boolean
}

/**
 * Общий чип-селектор жанров (`@features/catalog-filter/ui`, тот же паттерн «общий компонент,
 * два активных вызывающих варианта», что и `ActiveFilterChips` — см. `compact` ниже) —
 * заменяет захардкоженный `ALL_GENRES.map(...)` и в `SearchSidebar` (десктопный вариант фильтров
 * внутри `Search`), и в bottom-sheet-фильтрах того же `Search` (мобильный вариант, `compact`).
 *
 * Сам вызывает `useGenreDictionary()` — обычный синхронный хук без Suspense/`use()`, поэтому
 * вызывающей стороне не нужен `AsyncBoundary`/skeleton: компонент всегда рендерится сразу
 * (статический шорт-лист или уже закэшированный справочник), фоновая подгрузка справочника
 * из API реактивно подменяет список, когда (и если) придёт.
 */
export const GenreSelector = ({
  selected,
  onToggle,
  disabled,
  compact,
}: GenreSelectorProps) => {
  const [showAll, setShowAll] = useState(false)
  const genres = useGenreDictionary()

  // Видимый по умолчанию набор = STATIC_FALLBACK_GENRES ∪ selected, пересечённое с реально
  // доступными жанрами (genres — справочник, если загрузился, иначе тот же фолбэк). Уже
  // выбранный (deep-link) жанр, которого нет в загруженном справочнике, всё равно должен
  // быть отрисован и подсвечен без ручного «Показать все» — поэтому он всегда добавляется
  // в дефолтный набор отдельно, синтетическим Genre-объектом, если пересечение его не даёт.
  const defaultNames = new Set<string>([
    ...STATIC_FALLBACK_GENRES.map(g => g.name),
    ...selected,
  ])

  const availableDefaultGenres = genres.filter(g => defaultNames.has(g.name))
  const availableDefaultNames = new Set(availableDefaultGenres.map(g => g.name))
  // Лейблы всех реально доступных (справочник/фолбэк) жанров — используется, чтобы не
  // рендерить синтетический чип для legacy EN-значения (например ?genres=Drama из старых
  // ссылок), если его лейбл совпадает с лейблом уже существующего в справочнике жанра
  // (getGenreLabel('драма') тоже даёт 'Drama'): иначе получаются два визуально неотличимых
  // чипа с текстом "Drama" — один активный (синтетический), другой нет.
  const availableLabels = new Set(genres.map(g => getGenreLabel(g.name)))
  const missingSelectedGenres: Genre[] = selected
    .filter(
      name =>
        !availableDefaultNames.has(name) &&
        !availableLabels.has(getGenreLabel(name)),
    )
    .map(name => ({ name }))

  const defaultGenres = [...availableDefaultGenres, ...missingSelectedGenres]
  const restGenres = genres.filter(g => !defaultNames.has(g.name))

  const visibleGenres = showAll
    ? [...defaultGenres, ...restGenres]
    : defaultGenres

  return (
    <div className={s.container}>
      <div className={s.list}>
        {visibleGenres.map(genre => {
          const active = selected.includes(genre.name)
          return (
            <button
              type='button'
              key={genre.name}
              onClick={() => onToggle(genre.name)}
              disabled={disabled}
              aria-pressed={active}
              className={`${s.chip} ${compact ? s.chipCompact : ''} ${active ? s.chipActive : ''}`}
            >
              {getGenreLabel(genre.name)}
            </button>
          )
        })}
      </div>
      {restGenres.length > 0 && (
        <button
          type='button'
          onClick={() => setShowAll(prev => !prev)}
          className={`${s.toggle} ${compact ? s.toggleCompact : ''}`}
        >
          {showAll ? 'Свернуть' : `Показать все (${restGenres.length})`}
        </button>
      )}
    </div>
  )
}
