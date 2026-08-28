import { ChevronLeftIcon, ChevronRightIcon } from '@shared/ui'

import { buildPageRange, clampPage } from '../../lib/buildPageRange'

import s from './Pagination.module.css'

type PaginationProps = {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

/**
 * Единый компонент пагинации (Task 10, план `docs/plans/20260827-mobile-first-adaptive-layout.md`)
 * — до этой задачи существовал в двух копиях: этот JSX (`Pagination`, десктоп) и
 * почти идентичный инлайновый `MobilePagination` внутри удалённого `SearchMobile.tsx`. Оба уже
 * использовали общие pure-функции `buildPageRange`/`clampPage` (`../../lib/buildPageRange`) —
 * различался только JSX/CSS-обёрткой (толщина/размер кнопок, hover), не логика. Слияние —
 * "просто CSS" случай (см. Solution Overview плана): JSX ниже не менялся, разница между
 * брейкпоинтами выражена целиком в `Pagination.module.css` через mobile-first `@media
 * (min-width: 720px)`.
 */
export const Pagination = ({ page, totalPages, onChange }: PaginationProps) => {
  // Защита от рассинхрона: ?page из URL может временно выйти за пределы totalPages
  // (напр. смена фильтров ещё не долетела до фетчера) — клэмпим для рендера/disabled,
  // не мутируя проп и не решая за вызывающий код, что писать в URL.
  const safeTotalPages = Math.max(1, totalPages)
  const safePage = clampPage(page, totalPages)
  const pages = buildPageRange(page, totalPages)

  return (
    <div className={s.container}>
      <button
        type='button'
        disabled={safePage <= 1}
        onClick={() => onChange(Math.max(1, safePage - 1))}
        className={s.btn}
      >
        <ChevronLeftIcon size={11} />
      </button>
      {pages.map((p, i) =>
        typeof p === 'string' ? (
          <span key={p + i} className={s.ellipsis}>
            …
          </span>
        ) : (
          <button
            type='button'
            key={p}
            onClick={() => onChange(p)}
            className={`${s.btn}${p === safePage ? ` ${s.btnActive}` : ''}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type='button'
        disabled={safePage >= safeTotalPages}
        onClick={() => onChange(Math.min(safeTotalPages, safePage + 1))}
        className={s.btn}
      >
        <ChevronRightIcon size={11} />
      </button>
    </div>
  )
}
