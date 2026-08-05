import { ChevronLeftIcon, ChevronRightIcon } from '@shared/ui'
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
  const safePage = Math.min(Math.max(page, 1), safeTotalPages)

  const pages: (number | string)[] = []
  pages.push(1)
  const left = Math.max(2, safePage - 1)
  const right = Math.min(safeTotalPages - 1, safePage + 1)
  if (left > 2) pages.push('…L')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < safeTotalPages - 1) pages.push('…R')
  if (safeTotalPages > 1) pages.push(safeTotalPages)

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
