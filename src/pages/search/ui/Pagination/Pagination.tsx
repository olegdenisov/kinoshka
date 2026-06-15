import { ChevronLeftIcon, ChevronRightIcon } from '@shared/ui'
import s from './Pagination.module.css'

type PaginationProps = {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

export const Pagination = ({ page, totalPages, onChange }: PaginationProps) => {
  const pages: (number | string)[] = []
  pages.push(1)
  const left = Math.max(2, page - 1)
  const right = Math.min(totalPages - 1, page + 1)
  if (left > 2) pages.push('…L')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < totalPages - 1) pages.push('…R')
  if (totalPages > 1) pages.push(totalPages)

  return (
    <div className={s.container}>
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
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
            className={`${s.btn}${p === page ? ` ${s.btnActive}` : ''}`}
          >{p}</button>
        )
      )}
      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className={s.btn}
      >
        <ChevronRightIcon size={11} />
      </button>
    </div>
  )
}
