import { PROFILE_NAME_MAX_LENGTH, profileName } from '@features/profile'
import { initThemeSync, ThemeToggle } from '@features/theme'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { readPersisted, seedPersisted } from '../../../../test/persist'
import { Profile } from './Profile'

const PROFILE_KEY = 'kinoshka:profile'

const seedName = (name: string) => seedPersisted(PROFILE_KEY, name)

const renderProfile = () =>
  render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  )

// Большой аватар — первый aria-hidden внутри main (секция header идёт первой, иконки быстрых
// ссылок ниже по документу); не завязываемся на соседство с именем в DOM.
const getAvatar = (container: HTMLElement) =>
  container.querySelector('main [aria-hidden="true"]')

// Глобальный стаб matchMedia (src/test/setup.ts) всегда даёт matches: false — «мышиное»
// устройство. Для тач-сценария подменяем его: основной указатель грубый.
const stubCoarsePointer = () => {
  const original = window.matchMedia
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia

  return () => {
    window.matchMedia = original
  }
}

describe('Profile', () => {
  beforeEach(() => {
    localStorage.clear()
    initThemeSync()
  })

  // jsdom document общий между тестами файла — без сброса data-theme выставленная
  // предыдущим тестом тема утекла бы в следующий.
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  // Страховка на случай, если тест со spyOn(Storage.prototype, 'setItem') упадёт на одном из
  // expect до своего inline spy.mockRestore(): без этого бросающий spy утёк бы во все
  // последующие тесты файла (vite.config.ts не включает restoreMocks/clearMocks глобально).
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('без сохранённого имени показывает Guest и нет инициалов', () => {
    const { container } = renderProfile()

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue('')
    // без имени большой аватар рисует иконку-fallback, а не текст инициалов
    const avatar = getAvatar(container)
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
    expect(avatar?.querySelector('svg')).not.toBeNull()
    expect(avatar?.textContent).toBe('')
  })

  it('регион "Quick access" получает имя из заголовка (на него опирается e2e)', () => {
    renderProfile()

    const region = screen.getByRole('region', { name: 'Quick access' })
    expect(within(region).getAllByRole('link')).toHaveLength(5)
  })

  it('"Appearance" — заголовок h2 в outline и одновременно имя группы radio', () => {
    renderProfile()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Appearance' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Appearance' })).getAllByRole(
        'radio',
      ),
    ).toHaveLength(3)
  })

  it('сабмит формы сохраняет имя и обновляет инициалы', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), 'Oleg Denisov')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Oleg Denisov')).toBeInTheDocument()
    expect(screen.getByText('OD')).toBeInTheDocument()
    expect(screen.queryByText('Guest')).not.toBeInTheDocument()
    expect(readPersisted(PROFILE_KEY)).toBe('Oleg Denisov')
  })

  it('Save задизейблена, пока значение не изменилось, и активируется после правки', async () => {
    const user = userEvent.setup()
    seedName('Oleg')
    renderProfile()

    const save = screen.getByRole('button', { name: 'Save' })
    expect(screen.getByLabelText('Display name')).toHaveValue('Oleg')
    expect(save).toBeDisabled()

    await user.type(screen.getByLabelText('Display name'), 'x')
    expect(save).toBeEnabled()

    await user.type(screen.getByLabelText('Display name'), '{Backspace}')
    expect(save).toBeDisabled()
  })

  it('пробелы в конце существующего имени не активируют Save', async () => {
    const user = userEvent.setup()
    seedName('Oleg')
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), '  ')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('черновик с пробелами по краям поверх другого имени сохраняется тримленным, инпут пересинхронизируется', async () => {
    const user = userEvent.setup()
    seedName('Ann')
    renderProfile()

    const input = screen.getByLabelText('Display name')
    await user.clear(input)
    await user.type(input, '  Bob  ')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(readPersisted(PROFILE_KEY)).toBe('Bob')
    expect(input).toHaveValue('Bob')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('ввод из одних пробелов не сохраняется как имя', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), '   {Enter}')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(readPersisted(PROFILE_KEY)).toBeNull()
  })

  it('черновик из одних невидимых символов не активирует Save и не сохраняется', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByLabelText('Display name'))
    await user.paste('\u200B\u200D')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(screen.getByLabelText('Display name'), '{Enter}')
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(readPersisted(PROFILE_KEY)).toBeNull()
  })

  it('невидимое имя в localStorage (мимо UI) даёт Guest и иконку', () => {
    seedName('\u200B')
    const { container } = renderProfile()

    const avatar = getAvatar(container)
    expect(avatar?.querySelector('svg')).not.toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Clear name' }),
    ).not.toBeInTheDocument()
  })

  it('успешное сохранение возвращает фокус на инпут имени (Save дизейблится и теряет фокус)', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), 'Oleg')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByLabelText('Display name')).toHaveFocus()
  })

  it('Save с клавиатуры (Tab + Enter) возвращает фокус на инпут', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), 'Oleg')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByText('Oleg')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveFocus()
  })

  it('Enter из инпута сохраняет имя, фокус остаётся на инпуте', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), 'Oleg{Enter}')

    expect(screen.getByText('Oleg')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveFocus()
  })

  it('на тач-устройстве (грубый основной указатель) Save и Clear не переносят фокус на инпут', async () => {
    const restore = stubCoarsePointer()
    try {
      const user = userEvent.setup()
      renderProfile()
      const input = screen.getByLabelText('Display name')

      await user.type(input, 'Oleg')
      // уводим фокус с инпута: на тач-устройстве пользователь нажимает кнопку, не печатая в поле
      screen.getByRole('button', { name: 'Save' }).focus()
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(screen.getByText('Oleg')).toBeInTheDocument()
      expect(input).not.toHaveFocus()

      await user.click(screen.getByRole('button', { name: 'Clear name' }))
      expect(screen.getByText('Guest')).toBeInTheDocument()
      expect(input).not.toHaveFocus()
    } finally {
      restore()
    }
  })

  it('имя с эмодзи сохраняется целиком, инициалы не режут суррогатную пару', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByLabelText('Display name'))
    await user.paste('😀 Oleg')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('😀 Oleg')).toBeInTheDocument()
    expect(screen.getByText('😀O')).toBeInTheDocument()
    expect(readPersisted(PROFILE_KEY)).toBe('😀 Oleg')
  })

  it('имя ровно на лимите сохраняется целиком, лишний символ инпут не принимает', async () => {
    const user = userEvent.setup()
    renderProfile()
    const limitName = 'a'.repeat(PROFILE_NAME_MAX_LENGTH)

    await user.type(
      screen.getByLabelText('Display name'),
      `${limitName}b{Enter}`,
    )

    expect(screen.getByLabelText('Display name')).toHaveValue(limitName)
    expect(readPersisted(PROFILE_KEY)).toBe(limitName)
  })

  it('подтягивает имя, изменённое в другой вкладке, и не оставляет Save активной', async () => {
    seedName('Old')
    renderProfile()
    expect(screen.getByLabelText('Display name')).toHaveValue('Old')

    // подписка на 'storage' ставится в connect-hook атома асинхронно
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    seedName('New Name')
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: PROFILE_KEY,
          newValue: localStorage.getItem(PROFILE_KEY),
          storageArea: localStorage,
        }),
      )
    })

    expect(screen.getByLabelText('Display name')).toHaveValue('New Name')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('после сброса имени через profileName.set("") инпут пустеет, Save не активна', async () => {
    seedName('Oleg')
    renderProfile()
    expect(screen.getByLabelText('Display name')).toHaveValue('Oleg')

    await act(async () => {
      profileName.set('')
    })

    expect(screen.getByLabelText('Display name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText('Guest')).toBeInTheDocument()
  })

  it('счётчик избранного отражает содержимое localStorage', () => {
    seedPersisted('kinoshka:favorites', [1, 2, 3])
    renderProfile()

    expect(screen.getByRole('link', { name: /Favorites/ })).toHaveTextContent(
      '3',
    )
  })

  it('счётчик избранного равен 0 при пустом избранном', () => {
    renderProfile()

    expect(screen.getByRole('link', { name: /Favorites/ })).toHaveTextContent(
      '0',
    )
  })

  it('счётчик просмотренного отражает содержимое localStorage', () => {
    seedPersisted('kinoshka:watched', [1, 2])
    renderProfile()

    expect(screen.getByRole('link', { name: /Watched/ })).toHaveTextContent('2')
    expect(screen.getByRole('link', { name: /Watched/ })).toHaveAttribute(
      'href',
      '/watched',
    )
  })

  it('счётчик watchlist отражает содержимое localStorage', () => {
    seedPersisted('kinoshka:watchlist', [1, 2, 3])
    renderProfile()

    const link = screen.getByRole('link', { name: /^Watchlist/ })
    expect(link).toHaveTextContent('3')
    expect(link).toHaveAttribute('href', '/watchlist')
  })

  it('быстрые ссылки ведут на нужные пути', () => {
    renderProfile()

    expect(screen.getByRole('link', { name: /Favorites/ })).toHaveAttribute(
      'href',
      '/favorites',
    )
    expect(screen.getByRole('link', { name: /Popular/ })).toHaveAttribute(
      'href',
      '/popular',
    )
    expect(screen.getByRole('link', { name: /Picks/ })).toHaveAttribute(
      'href',
      '/recommendations',
    )
    expect(screen.getByRole('link', { name: /^Watchlist/ })).toHaveAttribute(
      'href',
      '/watchlist',
    )
  })

  it('выбор темы сохраняет её и отмечает выбранный вариант, включая system', async () => {
    const user = userEvent.setup()
    renderProfile()

    const group = screen.getByRole('group', { name: 'Appearance' })
    expect(group).toBeInTheDocument()
    // localStorage пуст → тема по умолчанию 'system'
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'System' })).not.toBeChecked()
    expect(readPersisted('kinoshka:theme')).toBe('dark')
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('dark'),
    )

    await user.click(screen.getByRole('radio', { name: 'Light' }))
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
    expect(readPersisted('kinoshka:theme')).toBe('light')
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('light'),
    )

    await user.click(screen.getByRole('radio', { name: 'System' }))
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    expect(readPersisted('kinoshka:theme')).toBe('system')
  })

  it('клик по ThemeToggle после выбора system заменяет его на явную тему (задокументированное поведение)', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ThemeToggle />
        <Profile />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('radio', { name: 'System' }))
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()

    // matchMedia-стаб (src/test/setup.ts, matches: false) даёт matches: false → system резолвится в light, toggle ставит dark
    await user.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    )

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'System' })).not.toBeChecked()
    expect(readPersisted('kinoshka:theme')).toBe('dark')
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('dark'),
    )
  })

  it('Clear name не отображается без имени', () => {
    renderProfile()

    expect(
      screen.queryByRole('button', { name: 'Clear name' }),
    ).not.toBeInTheDocument()
  })

  it('Clear name очищает заданное имя, скрывается и возвращает фокус на инпут (кнопка размонтирована)', async () => {
    const user = userEvent.setup()
    seedName('Oleg')
    renderProfile()

    await user.click(screen.getByRole('button', { name: 'Clear name' }))

    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue('')
    expect(
      screen.queryByRole('button', { name: 'Clear name' }),
    ).not.toBeInTheDocument()
    expect(readPersisted(PROFILE_KEY)).toBe('')
    // Кнопка Clear name размонтирована условием {name && ...} — без явного переноса фокус упал
    // бы на <body>.
    expect(screen.getByLabelText('Display name')).toHaveFocus()
  })

  it('Clear name отбрасывает несохранённый черновик', async () => {
    const user = userEvent.setup()
    seedName('Oleg')
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), '2')
    expect(screen.getByLabelText('Display name')).toHaveValue('Oleg2')

    await user.click(screen.getByRole('button', { name: 'Clear name' }))

    expect(screen.getByLabelText('Display name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('значение из одних пробелов в localStorage (мимо UI) даёт Guest и не показывает Clear name', () => {
    seedName('   ')
    renderProfile()

    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Clear name' }),
    ).not.toBeInTheDocument()
  })

  it('показывает информационную подпись про локальный профиль и не рисует кнопку входа', () => {
    renderProfile()

    expect(screen.getByText(/Local profile\./)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /sign in/i }),
    ).not.toBeInTheDocument()
  })
})
