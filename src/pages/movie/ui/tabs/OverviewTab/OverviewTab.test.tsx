import type { MovieDetail } from '@entities/movie'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { MOVIE } from '../../../testFixtures'
import { OverviewTab } from './OverviewTab'

const renderOverviewTab = (movie: MovieDetail = MOVIE) =>
  render(
    <MemoryRouter>
      <OverviewTab m={movie} />
    </MemoryRouter>,
  )

describe('OverviewTab — синопсис, жанры, страны, рейтинги', () => {
  it('показывает synopsis, жанры, страны и рейтинги без изменений', () => {
    renderOverviewTab()

    expect(screen.getByText(MOVIE.synopsis)).toBeInTheDocument()
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Finland · Portugal')).toBeInTheDocument()
    expect(screen.getByText('8.1')).toBeInTheDocument()
    expect(screen.getByText('7.9')).toBeInTheDocument()
    expect(screen.getByText('R')).toBeInTheDocument()
  })
})

describe('OverviewTab — ссылки на страницу персоны в crew', () => {
  it('рендерит имя члена съёмочной группы как ссылку на /person/:id', () => {
    renderOverviewTab()

    const link = screen.getByRole('link', { name: 'Hanna Vesper' })
    expect(link).toHaveAttribute('href', '/person/20')
  })

  it('между несколькими именами одной профессии есть разделитель ", "', () => {
    const movie: MovieDetail = {
      ...MOVIE,
      crew: [
        { id: 30, name: 'Алиса', profession: 'Сценарист' },
        { id: 31, name: 'Борис', profession: 'Сценарист' },
      ],
    }
    renderOverviewTab(movie)

    expect(screen.getByText('Сценарист')).toBeInTheDocument()
    const aliceLink = screen.getByRole('link', { name: 'Алиса' })
    const borisLink = screen.getByRole('link', { name: 'Борис' })
    expect(aliceLink).toHaveAttribute('href', '/person/30')
    expect(borisLink).toHaveAttribute('href', '/person/31')
    // Родитель обеих ссылок — .metaValue, разделитель между ними ", " — текстовый узел рядом.
    expect(aliceLink.parentElement!.parentElement?.textContent).toBe(
      'Алиса, Борис',
    )
  })

  it('профессия, где у единственного члена пустое имя, не рендерится вовсе', () => {
    const movie: MovieDetail = {
      ...MOVIE,
      crew: [{ id: 40, name: '', profession: 'Продюсер' }],
    }
    renderOverviewTab(movie)

    // Пустому имени нечего показать — ни текста, ни ссылки, ни строки метаданных
    // с пустым значением.
    expect(screen.queryByText('Продюсер')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('член съёмочной группы с пустым именем не оставляет висячий разделитель', () => {
    const movie: MovieDetail = {
      ...MOVIE,
      crew: [
        { id: 30, name: 'Алиса', profession: 'Сценарист' },
        { id: 31, name: '', profession: 'Сценарист' },
      ],
    }
    renderOverviewTab(movie)

    const aliceLink = screen.getByRole('link', { name: 'Алиса' })
    expect(aliceLink).toHaveAttribute('href', '/person/30')
    expect(screen.queryAllByRole('link')).toHaveLength(1)
    // Без пустого имени и без разделителя после него.
    expect(aliceLink.parentElement!.parentElement?.textContent).toBe('Алиса')
  })
})
