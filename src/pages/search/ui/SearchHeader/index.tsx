import s from './SearchHeader.module.css'

type SearchHeaderProps = {
  title: string
  resultsCount: number
  route: string
}

export const SearchHeader = ({ title, resultsCount, route }: SearchHeaderProps) => {
  return (
    <div className={s.wrapper}>
      <div className={s.breadcrumb}>Catalog · {route}</div>
      <h1 className={s.title}>
        {title}
        <span className={s.count}>{resultsCount.toLocaleString()} results</span>
      </h1>
    </div>
  )
}
