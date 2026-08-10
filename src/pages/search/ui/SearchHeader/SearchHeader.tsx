import s from './SearchHeader.module.css'

type SearchHeaderProps = {
  title: string
  /** Не всегда известен синхронно (real-data режимы каталога/поиска не отдают точный total) — опционален. */
  resultsCount?: number
  route: string
}

export const SearchHeader = ({ title, resultsCount, route }: SearchHeaderProps) => {
  return (
    <div className={s.wrapper}>
      <div className={s.breadcrumb}>Catalog · {route}</div>
      <h1 className={s.title}>
        {title}
        {resultsCount != null && (
          <span className={s.count}>{resultsCount.toLocaleString()} results</span>
        )}
      </h1>
    </div>
  )
}
