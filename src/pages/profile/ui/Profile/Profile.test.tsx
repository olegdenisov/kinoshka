import { PROFILE_NAME_MAX_LENGTH, useProfile } from '@features/profile'
import { ThemeToggle } from '@features/theme'
import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { Profile } from './Profile'

const PROFILE_KEY = 'kinoshka:profile'

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
    expect(within(region).getAllByRole('link')).toHaveLength(3)
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
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')).toBe(
      'Oleg Denisov',
    )
  })

  it('Save задизейблена, пока значение не изменилось, и активируется после правки', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
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
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), '  ')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('черновик с пробелами по краям поверх другого имени сохраняется тримленным, инпут пересинхронизируется', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Ann'))
    renderProfile()

    const input = screen.getByLabelText('Display name')
    await user.clear(input)
    await user.type(input, '  Bob  ')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')).toBe('Bob')
    expect(input).toHaveValue('Bob')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('ввод из одних пробелов не сохраняется как имя', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), '   {Enter}')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull()
  })

  it('черновик из одних невидимых символов не активирует Save и не сохраняется', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByLabelText('Display name'))
    await user.paste('\u200B\u200D')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(screen.getByLabelText('Display name'), '{Enter}')
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull()
  })

  it('невидимое имя в localStorage (мимо UI) даёт Guest и иконку', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify('\u200B'))
    const { container } = renderProfile()

    const avatar = getAvatar(container)
    expect(avatar?.querySelector('svg')).not.toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Clear name' }),
    ).not.toBeInTheDocument()
  })

  it('недоступное хранилище: Save показывает сообщение об ошибке, черновик сохраняется, правка убирает сообщение', async () => {
    const user = userEvent.setup()
    renderProfile()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    await user.type(screen.getByLabelText('Display name'), 'Oleg')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      /Couldn.t save the name/,
    )
    expect(screen.getByLabelText('Display name')).toHaveValue('Oleg')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByText('Guest')).toBeInTheDocument()

    vi.restoreAllMocks()
    await user.type(screen.getByLabelText('Display name'), '2')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Oleg2')).toBeInTheDocument()
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

  it('два отказа Save подряд переанонсируют ошибку — DOM-узел алерта меняется, а не переиспользуется', async () => {
    const user = userEvent.setup()
    renderProfile()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    await user.type(screen.getByLabelText('Display name'), 'Oleg')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const firstAlert = screen.getByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    const secondAlert = screen.getByRole('alert')

    expect(secondAlert).not.toBe(firstAlert)
  })

  it('стороннее изменение имени (другая вкладка) во время показанной ошибки сохранения убирает устаревший алерт', async () => {
    const user = userEvent.setup()
    renderProfile()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    await user.type(screen.getByLabelText('Display name'), 'Oleg')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    vi.restoreAllMocks()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('External'))
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: PROFILE_KEY,
          newValue: JSON.stringify('External'),
        }),
      )
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue('External')
  })

  it('имя с эмодзи сохраняется целиком, инициалы не режут суррогатную пару', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByLabelText('Display name'))
    await user.paste('😀 Oleg')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('😀 Oleg')).toBeInTheDocument()
    expect(screen.getByText('😀O')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')).toBe(
      '😀 Oleg',
    )
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
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')).toBe(
      limitName,
    )
  })

  it('подтягивает имя, изменённое в другой вкладке, и не оставляет Save активной', async () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Old'))
    renderProfile()
    expect(screen.getByLabelText('Display name')).toHaveValue('Old')

    localStorage.setItem(PROFILE_KEY, JSON.stringify('New Name'))
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: PROFILE_KEY,
          newValue: JSON.stringify('New Name'),
        }),
      )
    })

    expect(screen.getByLabelText('Display name')).toHaveValue('New Name')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('после сброса имени через clearName инпут пустеет, Save не активна', async () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
    const { result } = renderHook(() => useProfile())
    renderProfile()
    expect(screen.getByLabelText('Display name')).toHaveValue('Oleg')

    await act(async () => {
      result.current.clearName()
    })

    expect(screen.getByLabelText('Display name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText('Guest')).toBeInTheDocument()
  })

  it('счётчик избранного отражает содержимое localStorage', () => {
    localStorage.setItem('kinoshka:favorites', JSON.stringify([1, 2, 3]))
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
    expect(JSON.parse(localStorage.getItem('kinoshka:theme') ?? 'null')).toBe(
      'dark',
    )
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(screen.getByRole('radio', { name: 'Light' }))
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
    expect(JSON.parse(localStorage.getItem('kinoshka:theme') ?? 'null')).toBe(
      'light',
    )
    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(screen.getByRole('radio', { name: 'System' }))
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    expect(JSON.parse(localStorage.getItem('kinoshka:theme') ?? 'null')).toBe(
      'system',
    )
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
    expect(JSON.parse(localStorage.getItem('kinoshka:theme') ?? 'null')).toBe(
      'dark',
    )
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('Clear name не отображается без имени', () => {
    renderProfile()

    expect(
      screen.queryByRole('button', { name: 'Clear name' }),
    ).not.toBeInTheDocument()
  })

  it('Clear name очищает заданное имя, скрывается и возвращает фокус на инпут (кнопка размонтирована)', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
    renderProfile()

    await user.click(screen.getByRole('button', { name: 'Clear name' }))

    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue('')
    expect(
      screen.queryByRole('button', { name: 'Clear name' }),
    ).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')).toBe('')
    // Кнопка Clear name размонтирована условием {name && ...} — без явного переноса фокус упал
    // бы на <body>.
    expect(screen.getByLabelText('Display name')).toHaveFocus()
  })

  it('Clear name: недоступное хранилище показывает сообщение об ошибке с текстом про Clear, имя не сбрасывается', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
    renderProfile()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    await user.click(screen.getByRole('button', { name: 'Clear name' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      /Couldn.t clear the name/,
    )
    expect(screen.getByText('Oleg')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Clear name' }),
    ).toBeInTheDocument()
  })

  it('Clear-отказ хранилища не гасится редактированием инпута (гасится только устаревший Save-отказ)', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
    renderProfile()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    await user.click(screen.getByRole('button', { name: 'Clear name' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Couldn.t clear the name/,
    )

    await user.type(screen.getByLabelText('Display name'), '2')
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Couldn.t clear the name/,
    )
  })

  it('отказ Clear заменяет прежний отказ Save: текст алерта переключается на "clear"', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
    renderProfile()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    await user.type(screen.getByLabelText('Display name'), '2')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Couldn.t save the name/,
    )

    await user.click(screen.getByRole('button', { name: 'Clear name' }))

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Couldn.t clear the name/,
    )
  })

  it('стороннее изменение имени убирает и устаревший отказ Clear', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
    renderProfile()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    await user.click(screen.getByRole('button', { name: 'Clear name' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    vi.restoreAllMocks()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('External'))
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: PROFILE_KEY,
          newValue: JSON.stringify('External'),
        }),
      )
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue('External')
  })

  it('успешный Clear после отказа убирает алерт', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
    renderProfile()
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })

    await user.click(screen.getByRole('button', { name: 'Clear name' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    spy.mockRestore()
    await user.click(screen.getByRole('button', { name: 'Clear name' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Guest')).toBeInTheDocument()
  })

  it('Clear name отбрасывает несохранённый черновик', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PROFILE_KEY, JSON.stringify('Oleg'))
    renderProfile()

    await user.type(screen.getByLabelText('Display name'), '2')
    expect(screen.getByLabelText('Display name')).toHaveValue('Oleg2')

    await user.click(screen.getByRole('button', { name: 'Clear name' }))

    expect(screen.getByLabelText('Display name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('значение из одних пробелов в localStorage (мимо UI) даёт Guest и не показывает Clear name', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify('   '))
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
