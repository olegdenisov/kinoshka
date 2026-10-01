import { fireEvent, render, screen } from '@testing-library/react'

import { ChipSelect } from './ChipSelect'

const ITEMS = ['a', 'b', 'c', 'd']
const getLabel = (v: string) => v.toUpperCase()

const renderSelect = (
  props: Partial<React.ComponentProps<typeof ChipSelect>> = {},
) =>
  render(
    <ChipSelect
      items={ITEMS}
      defaults={['a', 'b']}
      selected={[]}
      getLabel={getLabel}
      onToggle={vi.fn()}
      groupLabel='Test'
      {...props}
    />,
  )

describe('ChipSelect', () => {
  it('по умолчанию показывает только шорт-лист', () => {
    renderSelect()

    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'C' })).not.toBeInTheDocument()
  })

  it('«Показать все» раскрывает остальное, «Свернуть» возвращает', () => {
    renderSelect()

    fireEvent.click(
      screen.getByRole('button', { name: 'Показать все (2): Test' }),
    )
    expect(screen.getByRole('button', { name: 'C' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Свернуть: Test' }))
    expect(screen.queryByRole('button', { name: 'C' })).not.toBeInTheDocument()
  })

  it('без defaults показаны все и кнопки «Показать все» нет', () => {
    renderSelect({ defaults: undefined })

    ITEMS.forEach(v => {
      expect(
        screen.getByRole('button', { name: v.toUpperCase() }),
      ).toBeInTheDocument()
    })
    expect(screen.queryByText(/Показать все/)).not.toBeInTheDocument()
  })

  it('выбранное вне шорт-листа показано и подсвечено; вне items - синтетический чип', () => {
    renderSelect({ selected: ['c', 'zzz'] })

    expect(screen.getByRole('button', { name: 'C' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'ZZZ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('синтетический чип не дублирует доступный лейбл', () => {
    renderSelect({ selected: ['A'] })

    expect(screen.getAllByRole('button', { name: 'A' })).toHaveLength(1)
  })

  it('клик по чипу вызывает onToggle', () => {
    const onToggle = vi.fn()
    renderSelect({ onToggle })

    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(onToggle).toHaveBeenCalledWith('a')
  })

  it('disabled дизейблит чипы', () => {
    renderSelect({ disabled: true })

    expect(screen.getByRole('button', { name: 'A' })).toBeDisabled()
  })

  it('compact добавляет вариант-класс чипам', () => {
    renderSelect({ compact: true })

    expect(screen.getByRole('button', { name: 'A' }).className).toMatch(
      /chipCompact/,
    )
  })

  describe('searchable', () => {
    it('поле поиска появляется только в развёрнутом состоянии', () => {
      renderSelect({ searchable: true })

      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
      fireEvent.click(
        screen.getByRole('button', { name: 'Показать все (2): Test' }),
      )
      expect(
        screen.getByRole('searchbox', { name: 'Поиск: Test' }),
      ).toBeInTheDocument()
    })

    it('фильтрация сужает список без учёта регистра', () => {
      renderSelect({ searchable: true, defaults: undefined })

      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'C' },
      })

      expect(screen.getByRole('button', { name: 'C' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'A' }),
      ).not.toBeInTheDocument()
    })

    it('выбранные чипы не скрываются фильтром', () => {
      renderSelect({ searchable: true, defaults: undefined, selected: ['a'] })

      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'c' },
      })

      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    })

    it('пустой результат не ломает рендер', () => {
      renderSelect({ searchable: true, defaults: undefined })

      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'xyz' },
      })

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.getByRole('searchbox')).toBeInTheDocument()
    })

    it('ищет по переведённому лейблу, а не только по значению', () => {
      const labels: Record<string, string> = { США: 'USA', Франция: 'France' }
      renderSelect({
        searchable: true,
        defaults: undefined,
        items: ['США', 'Франция'],
        getLabel: v => labels[v] ?? v,
      })

      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'usa' },
      })

      expect(screen.getByRole('button', { name: 'USA' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'France' }),
      ).not.toBeInTheDocument()
    })

    it('строка из пробелов не фильтрует список', () => {
      renderSelect({ searchable: true, defaults: undefined })

      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: '   ' },
      })

      expect(screen.getAllByRole('button')).toHaveLength(ITEMS.length)
    })

    it('disabled дизейблит поле поиска', () => {
      renderSelect({ searchable: true, defaults: undefined, disabled: true })

      expect(screen.getByRole('searchbox')).toBeDisabled()
    })

    it('«Свернуть» сбрасывает текст поиска', () => {
      renderSelect({ searchable: true })

      fireEvent.click(
        screen.getByRole('button', { name: 'Показать все (2): Test' }),
      )
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'c' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Свернуть: Test' }))
      fireEvent.click(
        screen.getByRole('button', { name: 'Показать все (2): Test' }),
      )

      expect(screen.getByRole('searchbox')).toHaveValue('')
      expect(screen.getByRole('button', { name: 'D' })).toBeInTheDocument()
    })
  })
})
