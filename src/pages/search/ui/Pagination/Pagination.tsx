import { ChevronLeftIcon, ChevronRightIcon } from '@shared/ui'
import { buildPageRange, clampPage } from '../../lib/buildPageRange'
import s from './Pagination.module.css'

type PaginationProps = {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

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
        disabled={safePage <= 1}
        onClick={() => onChange(Math.max(1, safePage - 1))}
        className={s.btn}
      >
        <ChevronLeftIcon size={11} />
      </button>
      {pages.map((p, i) =>
        typeof p === 'string' ? (
          <span key={p + i} className={s.ellipsis}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`${s.btn}${p === safePage ? ` ${s.btnActive}` : ''}`}
          >{p}</button>
        )
      )}
      <button
        disabled={safePage >= safeTotalPages}
        onClick={() => onChange(Math.min(safeTotalPages, safePage + 1))}
        className={s.btn}
      >
        <ChevronRightIcon size={11} />
      </button>
    </div>
  )
}
