import {
  ActiveFilterChips,
  activeChips,
  filters,
  removeFilterChip,
} from '@features/catalog-filter'
import { initThemeSync } from '@features/theme'
import { urlAtom } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { fireEvent, screen } from '@testing-library/react'
import { act } from 'react'

import { seedPersisted } from '../../../../test/persist'
import { renderWithRouter } from '../../../../test/router'
import { Header } from './Header'

/** Текущая строка query — способ проверить, что запись в URL реально произошла. */
let getUrl = () => ''
const currentSearch = () => {
  const url = getUrl()
  const i = url.indexOf('?')
  return i < 0 ? '' : url.slice(i)
}

/** Программная навигация без ремаунта Header — эмулирует смену ?q извне (browser back/forward, deep-link). */
const navigateTo = (to: string) => act(async () => urlAtom.go(to))

/** Debounce-таймер + цепочка промисов коммита и асинхронная перерисовка reatomComponent. */
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

const renderHeader = (initialEntries: string[]) => {
  const result = renderWithRouter(
    <Header variant='search' activeNav='search' />,
    { url: initialEntries[0] },
  )
  getUrl = result.getUrl
  return result
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  initThemeSync()
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

  it('ввод → через 250ms пишет ?q (replace: true, без лишней записи в историю)', async () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')
    const push = vi.spyOn(window.history, 'pushState')

    fireEvent.change(input, { target: { value: 'dune' } })
    await advance(200)
    expect(currentSearch()).toBe('')

    await advance(50)
    expect(currentSearch()).toBe('?q=dune')
    await advance(0)
    expect(push).not.toHaveBeenCalled()
  })

  it('min-length ровно QUERY_MIN_LENGTH (2 символа) — граница: ?q пишется', async () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'du' } })
    await advance(250)

    expect(currentSearch()).toBe('?q=du')
  })

  it('min-length < 2 — ?q не пишется', async () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'd' } })
    await advance(250)

    expect(currentSearch()).toBe('')
  })

  it('min-length < 2 после непустого — ?q чистится', async () => {
    renderHeader(['/search?q=dune'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'd' } })
    await advance(250)

    expect(currentSearch()).toBe('')
  })

  it('кнопка × при непустом q сбрасывает ?q немедленно (без ожидания дебаунса)', async () => {
    renderHeader(['/search?q=dune'])

    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Clear search' })),
    )

    expect(currentSearch()).toBe('')
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

  it('внешнее изменение ?q (навигация в истории, без ремаунта Header) — draft инпута пересинхронизируется с URL', async () => {
    renderHeader(['/search?q=dune'])

    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('dune')

    // Header не размонтируется — меняется только ?q, как при browser back/forward внутри /search.
    await navigateTo('/search?q=matrix')

    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('matrix')
  })

  it('внешнее изменение ?q на пусто (например, переход назад до состояния без query) — инпут очищается', async () => {
    renderHeader(['/search?q=dune'])

    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('dune')

    await navigateTo('/search')

    expect(
      screen.getByPlaceholderText('Search movies, series, anime…'),
    ).toHaveValue('')
  })
})

/** Тот же `Header`, что и в `AppLayout`: variant пересчитывается из текущего pathname — компонент
 * не размонтируется при смене роута (одна и та же позиция в дереве), меняются только пропы. */
const HeaderRouteChrome = reatomComponent(() => {
  const variant = urlAtom().pathname === '/search' ? 'search' : 'default'
  return (
    <Header
      variant={variant}
      activeNav={variant === 'search' ? 'search' : undefined}
    />
  )
}, 'HeaderRouteChrome')

describe('Header — ввод не пишет/не чистит URL вне variant="search"', () => {
  // `Header` не размонтируется между роутами внутри `AppLayout` (см. его докблок и
  // `HeaderRouteChrome` выше): набранный на /search черновик, коммит которого ещё спит, не должен
  // ни писать, ни чистить query-параметры роута, куда перешли.
  it('переход search → другой роут (без ремаунта Header) не оставляет/не чистит ?q целевого роута', async () => {
    const result = renderWithRouter(<HeaderRouteChrome />, {
      url: '/search?q=dune',
    })
    getUrl = result.getUrl

    const input = screen.getByPlaceholderText('Search movies, series, anime…')
    expect(input).toHaveValue('dune')
    fireEvent.change(input, { target: { value: 'dune 2' } })

    await navigateTo('/favorites?foo=bar')
    // Debounce-таймер успевает истечь — отложенный коммит не должен дописать ?q на новом роуте.
    await advance(250)

    expect(getUrl()).toBe('/favorites?foo=bar')
    expect(
      screen.queryByPlaceholderText('Search movies, series, anime…'),
    ).not.toBeInTheDocument()
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
    renderWithRouter(<Header variant='default' />, { url: '/' })

    expect(() =>
      fireEvent.keyDown(window, { code: 'KeyK', metaKey: true }),
    ).not.toThrow()
  })
})

/** Читает модель фильтров поверх текущего URL — проверяет, что после навигации по nav pill
 * реально применился фильтр и chip, а не только сменился ?type в адресной строке. */
const FilterProbe = reatomComponent(
  () => (
    <>
      <div data-testid='filter-type'>{filters().type ?? ''}</div>
      <ActiveFilterChips chips={activeChips()} onRemove={removeFilterChip} />
    </>
  ),
  'FilterProbe',
)

/** Мини-роутинг по pathname: `/` — обычный Header, `/search` — поисковый Header + фильтры. */
const App = reatomComponent(
  () =>
    urlAtom().pathname === '/search' ? (
      <>
        <Header variant='search' activeNav='search' />
        <FilterProbe />
      </>
    ) : (
      <Header variant='default' />
    ),
  'HeaderTestApp',
)

describe('Header — nav pills синхронизируют ?type с фильтром/chips', () => {
  const renderApp = (initialEntries: string[]) =>
    renderWithRouter(<App />, { url: initialEntries[0] })

  it.each([
    ['Movies', 'movie'],
    ['Series', 'series'],
    ['Anime', 'anime'],
  ])(
    'клик по "%s" на главной → /search?type=%s, фильтр и chip применяются',
    async (label, type) => {
      renderApp(['/'])

      await act(async () =>
        fireEvent.click(screen.getByRole('button', { name: label })),
      )

      expect(screen.getByTestId('filter-type')).toHaveTextContent(type)
      // nav pill + chip — оба должны показывать один и тот же лейбл после применения фильтра.
      expect(screen.getAllByText(label)).toHaveLength(2)
    },
  )

  it('переключение Movies → Series на /search обновляет ?type и chip без переоткрытия страницы', async () => {
    renderApp(['/search?type=movie'])

    expect(screen.getByTestId('filter-type')).toHaveTextContent('movie')
    expect(screen.getAllByText('Movies')).toHaveLength(2) // nav pill + chip

    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Series' })),
    )

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
    const { getUrl } = renderWithRouter(<Header variant='default' />, {
      url: '/',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Favorites' }))

    expect(getUrl()).toBe('/favorites')
  })

  it('activeNav="favorites" подсвечивает пункт "Favorites" как активный', () => {
    renderWithRouter(<Header variant='default' activeNav='favorites' />, {
      url: '/favorites',
    })

    expect(screen.getByRole('button', { name: 'Favorites' }).className).toMatch(
      /navPillActive/,
    )
    expect(screen.getByRole('button', { name: 'Home' }).className).not.toMatch(
      /navPillActive/,
    )
  })
})

describe('Header — пункт навигации Popular', () => {
  it('клик по "Popular" ведёт на /popular', () => {
    const { getUrl } = renderWithRouter(<Header variant='default' />, {
      url: '/',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Popular' }))

    expect(getUrl()).toBe('/popular')
  })

  it('activeNav="popular" подсвечивает пункт "Popular" как активный', () => {
    renderWithRouter(<Header variant='default' activeNav='popular' />, {
      url: '/popular',
    })

    expect(screen.getByRole('button', { name: 'Popular' }).className).toMatch(
      /navPillActive/,
    )
    expect(screen.getByRole('button', { name: 'Home' }).className).not.toMatch(
      /navPillActive/,
    )
  })
})

describe('Header — пункт навигации Picks', () => {
  it('клик по "Picks" ведёт на /recommendations', () => {
    const { getUrl } = renderWithRouter(<Header variant='default' />, {
      url: '/',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Picks' }))

    expect(getUrl()).toBe('/recommendations')
  })

  it('activeNav="recommendations" подсвечивает пункт "Picks" как активный', () => {
    renderWithRouter(<Header variant='default' activeNav='recommendations' />, {
      url: '/recommendations',
    })

    expect(screen.getByRole('button', { name: 'Picks' }).className).toMatch(
      /navPillActive/,
    )
    expect(screen.getByRole('button', { name: 'Home' }).className).not.toMatch(
      /navPillActive/,
    )
  })
})

describe('Header — accessible names на иконках без видимого текста (a11y baseline, Task 2)', () => {
  it('кнопка открытия поиска (variant="default") имеет aria-label="Open search"', () => {
    renderWithRouter(<Header variant='default' />, { url: '/' })

    expect(
      screen.getByRole('button', { name: 'Open search' }),
    ).toBeInTheDocument()
  })

  it('кнопка уведомлений имеет aria-label="Notifications"', () => {
    renderWithRouter(<Header variant='default' />, { url: '/' })

    expect(
      screen.getByRole('button', { name: 'Notifications' }),
    ).toBeInTheDocument()
  })
})

describe('Header — переключатель темы (ThemeToggle)', () => {
  it('кнопка-тоггл темы присутствует в actions', () => {
    renderWithRouter(<Header variant='default' />, { url: '/' })

    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })

  it('клик по тогглу меняет document.documentElement.dataset.theme', async () => {
    renderWithRouter(<Header variant='default' />, { url: '/' })

    const toggle = screen.getByRole('button', { name: /theme/i })

    await act(async () => fireEvent.click(toggle))

    // Global matchMedia stub (src/test/setup.ts) defaults matches: false → theme === 'system'
    // (localStorage empty) resolves to 'light' on mount, so one click flips it to 'dark'.
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('Header — аватар профиля (ProfileAvatar)', () => {
  it('без имени аватар — ссылка на /profile с доступным именем "Your profile"', () => {
    renderWithRouter(<Header variant='default' />, { url: '/' })

    const link = screen.getByRole('link', { name: 'Your profile' })
    expect(link).toHaveAttribute('href', '/profile')
  })

  it('в варианте search аватар тоже ссылка на /profile', () => {
    renderWithRouter(<Header variant='search' activeNav='search' />, {
      url: '/search',
    })

    expect(screen.getByRole('link', { name: 'Your profile' })).toHaveAttribute(
      'href',
      '/profile',
    )
  })

  it('с сохранённым именем показывает инициалы', () => {
    seedPersisted('kinoshka:profile', 'Oleg Denisov')

    renderWithRouter(<Header variant='default' />, { url: '/' })

    const link = screen.getByRole('link', {
      name: 'Your profile: Oleg Denisov',
    })
    expect(link).toHaveAttribute('href', '/profile')
    expect(link).toHaveTextContent('OD')
  })
})
