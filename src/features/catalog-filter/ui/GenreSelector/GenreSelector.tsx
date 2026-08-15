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
   * стороной (`SearchMobile.tsx`) явно — тот же паттерн variant-класса, что и у
   * `ActiveFilterChips`'s `compact`, вместо `@media` внутри собственного CSS-модуля: разметка
   * уже гарантированно рендерится только на одном брейкпоинте за раз (см. `useViewport`/
   * `SearchDesktop`/`SearchMobile`), так что медиа-запрос дублировал бы уже известную JS-сторону
   * информацию.
   */
  compact?: boolean
}

/**
 * Общий чип-селектор жанров (`@features/catalog-filter/ui`, тот же паттерн «общий компонент,
 * две responsive-точки использования», что и `ActiveFilterChips`) — заменяет захардкоженный
 * `ALL_GENRES.map(...)` и в `SearchSidebar` (desktop), и в `SearchMobile.tsx`.
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
