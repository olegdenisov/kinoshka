import { render, screen } from '@testing-library/react'

import { AvatarCircle } from './AvatarCircle'

describe('AvatarCircle', () => {
  it('с инициалами рисует текст и не рисует иконку-заглушку', () => {
    const { container } = render(<AvatarCircle initials='OD' size='sm' />)

    expect(screen.getByText('OD')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('без инициалов рисует иконку-заглушку: 20px для sm и 28px для lg', () => {
    const { container, rerender } = render(
      <AvatarCircle initials='' size='sm' />,
    )
    const small = container.querySelector('svg')
    expect(small).not.toBeNull()
    expect(small).toHaveAttribute('width', '20')

    rerender(<AvatarCircle initials='' size='lg' />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '28')
    expect(container.textContent).toBe('')
  })

  it('применяет класс размера и сливает внешний className', () => {
    const { container } = render(
      <AvatarCircle initials='A' size='lg' className='extra' />,
    )
    const el = container.firstElementChild

    expect(el).toHaveClass('extra')
    // CSS-модули в тестах отдают стабильные имена классов: у lg и sm они различаются
    const other = render(<AvatarCircle initials='A' size='sm' />).container
      .firstElementChild
    expect(el?.className).not.toBe(other?.className)
  })

  it('пробрасывает остальные пропсы (aria-hidden и т.п.) на корневой div', () => {
    const { container } = render(
      <AvatarCircle initials='A' size='sm' aria-hidden='true' data-x='1' />,
    )

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.firstElementChild).toHaveAttribute('data-x', '1')
  })
})
