import { render } from '@testing-library/react'

import { Spinner } from './index'

describe('Spinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<Spinner />)
    expect(container.firstChild).toBeTruthy()
  })

  it('does not set --spinner-size when no size prop is given', () => {
    const { container } = render(<Spinner />)
    const el = container.firstChild as HTMLElement
    expect(el.style.getPropertyValue('--spinner-size')).toBe('')
  })

  it('sets --spinner-size custom property when size is given', () => {
    const { container } = render(<Spinner size={14} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.getPropertyValue('--spinner-size')).toBe('14px')
  })
})
