import { useEffect, useRef } from 'react'
import { SearchIcon } from '@shared/ui'
import s from './SearchField.module.css'

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  placeholder?: string
}

export const SearchField = ({ value, onChange, onSubmit, placeholder = 'Search movies, series, anime…' }: SearchFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(value)
  }

  return (
    <form className={s.field} onSubmit={handleSubmit}>
      <SearchIcon />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={s.input}
      />
      <span className={s.hint}>⌘K</span>
    </form>
  )
}
