import { ActiveFilterChips, useFilterState } from '@features/catalog-filter'
import { fireEvent, render, screen } from '@testing-library/react'
import { act, useEffect } from 'react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'

import { Header } from './Header'

/** Читает текущую строку query из роутера — способ проверить, что запись в URL реально произошла. */
let lastSearch = ''
const LocationProbe = () => {
  const { search } = useLocation()
  useEffect(() => {
    lastSearch = search
  }, [search])
  return null
}

/** Программная навигация без ремаунта Header — эмулирует смену ?q извне (browser back/forward, deep-link). */
const NavigateProbe = ({ to }: { to: string | null }) => {
  const navigate = useNavigate()
  useEffect(() => {
    if (to !== null) {
      navigate(to)
    }
  }, [to, navigate])
  return null
}

const renderHeader = (initialEntries: string[]) => {
  lastSearch = ''
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Header variant='search' activeNav='search' />
      <LocationProbe />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  // ThemeToggle (рендерится в Header безусловно, см. Task 7) применяет data-theme на
  // document.documentElement — jsdom document общий между тестами файла, сбрасываем, чтобы
  // тема, выставленная одним тестом, не утекала в следующий (см. ThemeToggle.test.tsx).
  document.documentElement.removeAttribute('data-theme')
})

describe('Header (variant="search")', () => {
  it('role="search" на контейнере поиска', () => {
    renderHeader(['/search'])
    expect(screen.getByRole('search')).toBeInTheDocument()
  })

  it('ввод → через 250ms пишет ?q (replace: true, без лишней записи в историю)', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'dune' } })
    expect(lastSearch).toBe('')

    act(() => vi.advanceTimersByTime(250))
    expect(lastSearch).toBe('?q=dune')
  })

  it('min-length ровно QUERY_MIN_LENGTH (2 символа) — граница: ?q пишется', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'du' } })
    act(() => vi.advanceTimersByTime(250))

    expect(lastSearch).toBe('?q=du')
  })

  it('min-length < 2 — ?q не пишется', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'd' } })
    act(() => vi.advanceTimersByTime(250))

    expect(lastSearch).toBe('')
  })

  it('min-length < 2 после непустого — ?q чистится', () => {
    renderHeader(['/search?q=dune'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'd' } })
    act(() => vi.advanceTimersByTime(250))

    expect(lastSearch).toBe('')
  })

  it('кнопка × при непустом q сбрасывает ?q немедленно (без ожидания дебаунса)', () => {
    renderHeader(['/search?q=dune'])

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(lastSearch).toBe('')
    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('')
  })

  it('инициализация инпута из URL', () => {
    renderHeader(['/search?q=dune'])
    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('dune')
  })

  it('внешнее изменение ?q (навигация в истории, без ремаунта Header) — draft инпута пересинхронизируется с URL', () => {
    lastSearch = ''
    const { rerender } = render(
      <MemoryRouter initialEntries={['/search?q=dune']}>
        <Header variant='search' activeNav='search' />
        <LocationProbe />
        <NavigateProbe to={null} />
      </MemoryRouter>,
    )

    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('dune')

    // Header не размонтируется (тот же MemoryRouter/тот же /search) — только меняется ?q,
    // как при browser back/forward внутри /search.
    act(() => {
      rerender(
        <MemoryRouter initialEntries={['/search?q=dune']}>
          <Header variant='search' activeNav='search' />
          <LocationProbe />
          <NavigateProbe to='/search?q=matrix' />
        </MemoryRouter>,
      )
    })

    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('matrix')
  })

  it('внешнее изменение ?q на пусто (например, переход назад до состояния без query) — инпут очищается', () => {
    lastSearch = ''
    const { rerender } = render(
      <MemoryRouter initialEntries={['/search?q=dune']}>
        <Header variant='search' activeNav='search' />
        <LocationProbe />
        <NavigateProbe to={null} />
      </MemoryRouter>,
    )

    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('dune')

    act(() => {
      rerender(
        <MemoryRouter initialEntries={['/search?q=dune']}>
          <Header variant='search' activeNav='search' />
          <LocationProbe />
          <NavigateProbe to='/search' />
        </MemoryRouter>,
      )
    })

    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('')
  })
})

describe('Header — ⌘K/Ctrl+K фокусирует поле поиска (подсказка была чисто визуальной)', () => {
  it('⌘K (metaKey) фокусирует инпут', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')
    expect(input).not.toHaveFocus()

    fireEvent.keyDown(window, { code: 'KeyK', metaKey: true })

    expect(input).toHaveFocus()
  })

  it('Ctrl+K (не-Mac) тоже фокусирует инпут', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.keyDown(window, { code: 'KeyK', ctrlKey: true })

    expect(input).toHaveFocus()
  })

  it('срабатывает по физической клавише (code) независимо от раскладки — кириллическая ЙЦУКЕН даёт key="л" на той же клавише', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.keyDown(window, { key: 'л', code: 'KeyK', metaKey: true })

    expect(input).toHaveFocus()
  })

  it('preventDefault вызывается — браузерный шорткат по ⌘K не срабатывает поверх', () => {
    renderHeader(['/search'])

    const event = new KeyboardEvent('keydown', {
      code: 'KeyK',
      metaKey: true,
      cancelable: true,
    })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('обычная K без modifier-клавиши не фокусирует инпут', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.keyDown(window, { code: 'KeyK' })

    expect(input).not.toHaveFocus()
  })

  it('⌘ с другой клавишей (не K) не фокусирует инпут', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.keyDown(window, { code: 'KeyJ', metaKey: true })

    expect(input).not.toHaveFocus()
  })

  it('вне variant="search" (инпута нет в DOM) — ⌘K не падает', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Header variant='default' />
      </MemoryRouter>,
    )

    expect(() =>
      fireEvent.keyDown(window, { code: 'KeyK', metaKey: true }),
    ).not.toThrow()
  })
})

/** Читает useFilterState() поверх текущего URL — проверяет, что после навигации по nav pill
 * реально применился фильтр и chip, а не только сменился ?type в адресной строке. */
const FilterProbe = () => {
  const { filters, activeChips } = useFilterState()
  return (
    <>
      <div data-testid='filter-type'>{filters.type ?? ''}</div>
      <ActiveFilterChips chips={activeChips} />
    </>
  )
}

const SearchPage = () => (
  <>
    <Header variant='search' activeNav='search' />
    <FilterProbe />
  </>
)

describe('Header — nav pills синхронизируют ?type с фильтром/chips', () => {
  const renderApp = (initialEntries: string[]) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path='/' element={<Header variant='default' />} />
          <Route path='/search' element={<SearchPage />} />
        </Routes>
      </MemoryRouter>,
    )

  it.each([
    ['Movies', 'movie'],
    ['Series', 'series'],
    ['Anime', 'anime'],
  ])(
    'клик по "%s" на главной → /search?type=%s, фильтр и chip применяются',
    (label, type) => {
      renderApp(['/'])

      fireEvent.click(screen.getByRole('button', { name: label }))

      expect(screen.getByTestId('filter-type')).toHaveTextContent(type)
      // nav pill + chip — оба должны показывать один и тот же лейбл после применения фильтра.
      expect(screen.getAllByText(label)).toHaveLength(2)
    },
  )

  it('переключение Movies → Series на /search обновляет ?type и chip без переоткрытия страницы', () => {
    renderApp(['/search?type=movie'])

    expect(screen.getByTestId('filter-type')).toHaveTextContent('movie')
    expect(screen.getAllByText('Movies')).toHaveLength(2) // nav pill + chip

    fireEvent.click(screen.getByRole('button', { name: 'Series' }))

    expect(screen.getByTestId('filter-type')).toHaveTextContent('series')
    expect(screen.getAllByText('Series')).toHaveLength(2) // nav pill + chip
    expect(screen.getAllByText('Movies')).toHaveLength(1) // только nav pill, chip снят
  })
})

describe('Header (variant="search") — панель type-фильтров', () => {
  it('содержит только Movies/Series/Anime — без Favorites', () => {
    renderHeader(['/search'])

    const pillsNav = screen.getByRole('search').nextElementSibling
    expect(pillsNav).not.toBeNull()
    expect(
      Array.from(pillsNav!.querySelectorAll('button')).map(b => b.textContent),
    ).toEqual(['Movies', 'Series', 'Anime'])
  })
})

describe('Header — пункт навигации Favorites', () => {
  it('клик по "Favorites" ведёт на /favorites', () => {
    let lastPathname = ''
    const PathnameProbe = () => {
      const { pathname } = useLocation()
      useEffect(() => {
        lastPathname = pathname
      }, [pathname])
      return null
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <Header variant='default' />
        <PathnameProbe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Favorites' }))

    expect(lastPathname).toBe('/favorites')
  })

  it('activeNav="favorites" подсвечивает пункт "Favorites" как активный', () => {
    render(
      <MemoryRouter initialEntries={['/favorites']}>
        <Header variant='default' activeNav='favorites' />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Favorites' }).className).toMatch(
      /navPillActive/,
    )
    expect(screen.getByRole('button', { name: 'Home' }).className).not.toMatch(
      /navPillActive/,
    )
  })
})

describe('Header — переключатель темы (ThemeToggle)', () => {
  it('кнопка-тоггл темы присутствует в actions', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Header variant='default' />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })

  it('клик по тогглу меняет document.documentElement.dataset.theme', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Header variant='default' />
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: /theme/i })

    fireEvent.click(toggle)

    // Global matchMedia stub (src/test/setup.ts) defaults matches: false → theme === 'system'
    // (localStorage empty) resolves to 'light' on mount, so one click flips it to 'dark'.
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
