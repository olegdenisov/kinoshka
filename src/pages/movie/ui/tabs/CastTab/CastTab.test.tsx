import type { CastMember } from '@entities/movie'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { CastTab } from './CastTab'

const makeCast = (overrides: Partial<CastMember> = {}): CastMember => ({
  id: 10,
  name: 'Liv Korhonen',
  role: 'Ines Varga',
  photo: 'https://example.com/liv.jpg',
  ...overrides,
})

const renderCastTab = (cast: CastMember[]) =>
  render(
    <MemoryRouter>
      <CastTab cast={cast} />
    </MemoryRouter>,
  )

describe('CastTab — ссылки на страницу персоны', () => {
  it('рендерит карточку актёра как ссылку на /person/:id', () => {
    renderCastTab([makeCast()])

    const link = screen.getByRole('link', { name: /Liv Korhonen/ })
    expect(link).toHaveAttribute('href', '/person/10')
  })

  it('у персоны без фото рендерится градиентная заглушка, ссылка сохраняет доступное имя', () => {
    const { container } = renderCastTab([makeCast({ photo: undefined })])

    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Liv Korhonen/ }),
    ).toBeInTheDocument()
  })

  it('персона с пустым именем рендерится обычным div без ссылки', () => {
    renderCastTab([makeCast({ name: '' })])

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('as Ines Varga')).toBeInTheDocument()
  })

  it('две записи одной персоны с разными ролями рендерятся обе', () => {
    renderCastTab([
      makeCast({ id: 30, role: 'First role' }),
      makeCast({ id: 30, role: 'Second role' }),
    ])

    expect(screen.getByText('as First role')).toBeInTheDocument()
    expect(screen.getByText('as Second role')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Liv Korhonen/ })).toHaveLength(
      2,
    )
  })
})
