import { render, screen } from '@testing-library/react'

import { PersonFacts } from './PersonFacts'

const renderPersonFacts = (facts: string[]) =>
  render(<PersonFacts facts={facts} />)

describe('PersonFacts', () => {
  it('непустые факты → все пункты видны, обёрнуты в список', () => {
    renderPersonFacts([
      'He was born on January 1, 1990.',
      'He is a famous actor.',
      'He won an award in 2020.',
    ])

    expect(
      screen.getByRole('heading', { level: 2, name: 'Facts' }),
    ).toBeInTheDocument()

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('He was born on January 1, 1990.')
    expect(items[1]).toHaveTextContent('He is a famous actor.')
    expect(items[2]).toHaveTextContent('He won an award in 2020.')
  })

  it('пустые факты → секция не рендерится', () => {
    renderPersonFacts([])

    expect(
      screen.queryByRole('heading', { level: 2, name: 'Facts' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
