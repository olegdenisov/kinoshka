import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { FilterGroup } from './FilterGroup'

const details = (title: string) =>
  screen.getByText(title).closest('details') as HTMLDetailsElement

describe('FilterGroup', () => {
  it('defaultOpen=true: раскрыта, дети видны', () => {
    render(
      <FilterGroup title='Genre' defaultOpen>
        <p>content</p>
      </FilterGroup>,
    )
    expect(details('Genre').open).toBe(true)
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('defaultOpen=false: закрыта, детей в DOM нет', () => {
    render(
      <FilterGroup title='Genre'>
        <p>content</p>
      </FilterGroup>,
    )
    expect(details('Genre').open).toBe(false)
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('счётчик показывается при count > 0 и скрыт при 0', () => {
    const { rerender } = render(
      <FilterGroup title='Genre' count={3}>
        <p>x</p>
      </FilterGroup>,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    rerender(
      <FilterGroup title='Genre' count={0}>
        <p>x</p>
      </FilterGroup>,
    )
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('клик по summary раскрывает, дети остаются после сворачивания', async () => {
    const user = userEvent.setup()
    render(
      <FilterGroup title='Genre'>
        <p>content</p>
      </FilterGroup>,
    )
    await user.click(screen.getByText('Genre'))
    expect(await screen.findByText('content')).toBeInTheDocument()

    await user.click(screen.getByText('Genre'))
    await waitFor(() => expect(details('Genre').open).toBe(false))
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('смена defaultOpen после монтирования не закрывает группу', async () => {
    const { rerender } = render(
      <FilterGroup title='Genre' defaultOpen>
        <p>content</p>
      </FilterGroup>,
    )
    rerender(
      <FilterGroup title='Genre' defaultOpen={false}>
        <p>content</p>
      </FilterGroup>,
    )
    expect(details('Genre').open).toBe(true)
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})
