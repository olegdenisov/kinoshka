import { fireEvent, render, screen } from '@testing-library/react'

import { YEAR_SLIDER_MAX, YEAR_SLIDER_MIN } from './yearRangeBounds'
import { YearRangeSlider } from './YearRangeSlider'

describe('YearRangeSlider', () => {
  it('рендерит два range-input с aria-label и значениями из пропов', () => {
    render(<YearRangeSlider yearFrom={2010} yearTo={2020} onChange={vi.fn()} />)

    const from = screen.getByRole('slider', { name: 'Year from' })
    const to = screen.getByRole('slider', { name: 'Year to' })

    expect(from).toHaveValue('2010')
    expect(to).toHaveValue('2020')
  })

  it('null/null даёт дефолт — полный диапазон [YEAR_SLIDER_MIN, YEAR_SLIDER_MAX]', () => {
    render(<YearRangeSlider yearFrom={null} yearTo={null} onChange={vi.fn()} />)

    const from = screen.getByRole('slider', { name: 'Year from' })
    const to = screen.getByRole('slider', { name: 'Year to' })

    expect(from).toHaveValue(String(YEAR_SLIDER_MIN))
    expect(to).toHaveValue(String(YEAR_SLIDER_MAX))
  })

  it('deep-link только с yearFrom (yearTo: null) рендерит асимметричную позицию — to упирается в YEAR_SLIDER_MAX', () => {
    render(<YearRangeSlider yearFrom={2015} yearTo={null} onChange={vi.fn()} />)

    expect(screen.getByRole('slider', { name: 'Year from' })).toHaveValue(
      '2015',
    )
    expect(screen.getByRole('slider', { name: 'Year to' })).toHaveValue(
      String(YEAR_SLIDER_MAX),
    )
  })

  it('deep-link только с yearTo (yearFrom: null) рендерит асимметричную позицию — from упирается в YEAR_SLIDER_MIN', () => {
    render(<YearRangeSlider yearFrom={null} yearTo={1995} onChange={vi.fn()} />)

    expect(screen.getByRole('slider', { name: 'Year from' })).toHaveValue(
      String(YEAR_SLIDER_MIN),
    )
    expect(screen.getByRole('slider', { name: 'Year to' })).toHaveValue('1995')
  })

  it('внешнее изменение yearFrom/yearTo (например Reset filters) пересинхронизирует DOM-значения через rerender', () => {
    const { rerender } = render(
      <YearRangeSlider yearFrom={1990} yearTo={2010} onChange={vi.fn()} />,
    )

    const from = screen.getByRole('slider', { name: 'Year from' })
    const to = screen.getByRole('slider', { name: 'Year to' })
    expect(from).toHaveValue('1990')
    expect(to).toHaveValue('2010')

    // "Reset filters"/удаление чипа меняет пропы родителя напрямую (не через drag) — компонент
    // должен подхватить новые значения, а не остаться залипшим на старом локальном стейте.
    rerender(
      <YearRangeSlider yearFrom={null} yearTo={null} onChange={vi.fn()} />,
    )

    expect(from).toHaveValue(String(YEAR_SLIDER_MIN))
    expect(to).toHaveValue(String(YEAR_SLIDER_MAX))
  })

  it('деплинк с yearFrom вне [YEAR_SLIDER_MIN, YEAR_SLIDER_MAX] клэмпится в границы слайдера', () => {
    render(
      <YearRangeSlider
        yearFrom={YEAR_SLIDER_MIN - 500}
        yearTo={YEAR_SLIDER_MAX + 500}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('slider', { name: 'Year from' })).toHaveValue(
      String(YEAR_SLIDER_MIN),
    )
    expect(screen.getByRole('slider', { name: 'Year to' })).toHaveValue(
      String(YEAR_SLIDER_MAX),
    )
  })

  it('деплинк с перевёрнутой парой (yearFrom > yearTo) нормализуется по порядку', () => {
    render(<YearRangeSlider yearFrom={2015} yearTo={2000} onChange={vi.fn()} />)

    expect(screen.getByRole('slider', { name: 'Year from' })).toHaveValue(
      '2000',
    )
    expect(screen.getByRole('slider', { name: 'Year to' })).toHaveValue('2015')
  })

  it('пересинхронизация через rerender с вне-диапазонными пропами тоже клэмпится', () => {
    const { rerender } = render(
      <YearRangeSlider yearFrom={2010} yearTo={2020} onChange={vi.fn()} />,
    )

    rerender(
      <YearRangeSlider
        yearFrom={YEAR_SLIDER_MIN - 100}
        yearTo={YEAR_SLIDER_MAX + 100}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('slider', { name: 'Year from' })).toHaveValue(
      String(YEAR_SLIDER_MIN),
    )
    expect(screen.getByRole('slider', { name: 'Year to' })).toHaveValue(
      String(YEAR_SLIDER_MAX),
    )
  })

  it('keyup без изменения значения (например Tab-фокус на другой ползунок) НЕ коммитит onChange', () => {
    const onChange = vi.fn()
    render(
      <YearRangeSlider yearFrom={2010} yearTo={2020} onChange={onChange} />,
    )

    const from = screen.getByRole('slider', { name: 'Year from' })
    const to = screen.getByRole('slider', { name: 'Year to' })

    // Tab-фокус доставляет keyup новому активному ползунку без единого события change.
    fireEvent.keyUp(from)
    fireEvent.keyUp(to)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('mouseup/touchend без предшествующего change (клик без движения) НЕ коммитит повторно то же значение', () => {
    const onChange = vi.fn()
    render(
      <YearRangeSlider yearFrom={2010} yearTo={2020} onChange={onChange} />,
    )

    const from = screen.getByRole('slider', { name: 'Year from' })

    fireEvent.change(from, { target: { value: '2015' } })
    fireEvent.mouseUp(from)
    expect(onChange).toHaveBeenCalledTimes(1)

    // Второй mouseup без промежуточного change коммитит то же самое значение — не должен
    // вызывать onChange повторно.
    fireEvent.mouseUp(from)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('onTouchCancel откатывает локальный стейт к последнему закоммиченному значению, не коммитя', () => {
    const onChange = vi.fn()
    render(
      <YearRangeSlider yearFrom={2010} yearTo={2020} onChange={onChange} />,
    )

    const from = screen.getByRole('slider', { name: 'Year from' })

    fireEvent.change(from, { target: { value: '2016' } })
    expect(from).toHaveValue('2016')

    fireEvent.touchCancel(from)

    expect(from).toHaveValue('2010')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('cross-linked атрибуты: max у "from" = текущее значение "to", min у "to" = текущее значение "from"', () => {
    render(<YearRangeSlider yearFrom={2010} yearTo={2020} onChange={vi.fn()} />)

    const from = screen.getByRole('slider', { name: 'Year from' })
    const to = screen.getByRole('slider', { name: 'Year to' })

    expect(from).toHaveAttribute('max', '2020')
    expect(to).toHaveAttribute('min', '2010')

    // перетаскивание "from" вправо (fireEvent.change) двигает cross-linked min у "to"
    fireEvent.change(from, { target: { value: '2015' } })
    expect(to).toHaveAttribute('min', '2015')
    // max у "from" остаётся ограничен текущим значением "to" — не пересекает его
    expect(from).toHaveAttribute('max', '2020')
  })

  it('onChange НЕ вызывается на промежуточных change, но вызывается один раз на mouseup с закоммиченными значениями', () => {
    const onChange = vi.fn()
    render(
      <YearRangeSlider yearFrom={2010} yearTo={2020} onChange={onChange} />,
    )

    const from = screen.getByRole('slider', { name: 'Year from' })

    fireEvent.change(from, { target: { value: '2012' } })
    fireEvent.change(from, { target: { value: '2015' } })
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.mouseUp(from)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(2015, 2020)
  })

  it('onChange вызывается один раз на touchend с закоммиченными значениями', () => {
    const onChange = vi.fn()
    render(
      <YearRangeSlider yearFrom={2010} yearTo={2020} onChange={onChange} />,
    )

    const to = screen.getByRole('slider', { name: 'Year to' })

    fireEvent.change(to, { target: { value: '2018' } })
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.touchEnd(to)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(2010, 2018)
  })

  it('onChange также вызывается на keyup (коммит по клавиатуре, без mouseup/touchend)', () => {
    const onChange = vi.fn()
    render(
      <YearRangeSlider yearFrom={2010} yearTo={2020} onChange={onChange} />,
    )

    const from = screen.getByRole('slider', { name: 'Year from' })

    fireEvent.change(from, { target: { value: '2011' } })
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyUp(from)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(2011, 2020)
  })

  it('коммит обратно к полному дефолтному диапазону вызывает onChange(null, null)', () => {
    const onChange = vi.fn()
    render(
      <YearRangeSlider yearFrom={2010} yearTo={2020} onChange={onChange} />,
    )

    const from = screen.getByRole('slider', { name: 'Year from' })
    const to = screen.getByRole('slider', { name: 'Year to' })

    fireEvent.change(from, { target: { value: String(YEAR_SLIDER_MIN) } })
    fireEvent.mouseUp(from)
    expect(onChange).toHaveBeenLastCalledWith(YEAR_SLIDER_MIN, 2020)

    fireEvent.change(to, { target: { value: String(YEAR_SLIDER_MAX) } })
    fireEvent.mouseUp(to)
    expect(onChange).toHaveBeenLastCalledWith(null, null)
  })

  it('disabled дизейблит оба input', () => {
    render(
      <YearRangeSlider
        yearFrom={2010}
        yearTo={2020}
        onChange={vi.fn()}
        disabled
      />,
    )

    expect(screen.getByRole('slider', { name: 'Year from' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Year to' })).toBeDisabled()
  })

  it('проп compact применяет compact-класс к корневому элементу', () => {
    const { container } = render(
      <YearRangeSlider
        yearFrom={2010}
        yearTo={2020}
        onChange={vi.fn()}
        compact
      />,
    )

    expect(container.firstChild).toHaveProperty('className')
    expect((container.firstChild as HTMLElement).className).toMatch(/compact/)
  })

  it('без пропа compact компонент рендерится без compact-класса', () => {
    const { container } = render(
      <YearRangeSlider yearFrom={2010} yearTo={2020} onChange={vi.fn()} />,
    )

    expect((container.firstChild as HTMLElement).className).not.toMatch(
      /compact/,
    )
  })
})
