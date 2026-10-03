import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { seedPersisted } from '../../../../test/persist'
import { ProfileAvatar } from './ProfileAvatar'

const renderAvatar = () =>
  render(
    <MemoryRouter>
      <ProfileAvatar />
    </MemoryRouter>,
  )

describe('ProfileAvatar', () => {
  it('без имени — ссылка на /profile с именем "Your profile" и без текстовых инициалов', () => {
    renderAvatar()

    const link = screen.getByRole('link', { name: 'Your profile' })
    expect(link.getAttribute('href')).toBe('/profile')
    expect(link.textContent).toBe('')
    expect(link.querySelector('svg')).not.toBeNull()
  })

  it('имя из одного слова даёт одну инициал-букву', () => {
    seedPersisted('kinoshka:profile', 'oleg')
    renderAvatar()

    expect(screen.getByRole('link').textContent).toBe('O')
  })

  it('имя, начинающееся с эмодзи, не режет суррогатную пару', () => {
    seedPersisted('kinoshka:profile', '😀 Oleg')
    renderAvatar()

    expect(screen.getByRole('link').textContent).toBe('😀O')
  })

  it('имя с ведущим невидимым символом (ZWSP) рисует видимый инициал, а не пустой кружок', () => {
    seedPersisted('kinoshka:profile', '\u200BAda')
    renderAvatar()

    const link = screen.getByRole('link')
    expect(link.textContent).toBe('A')
    expect(link.querySelector('svg')).toBeNull()
  })

  it('на /profile ссылка помечена aria-current="page", на других страницах — нет', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/profile']}>
        <ProfileAvatar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page')
    unmount()

    renderAvatar()
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current')
  })

  it('с сохранённым именем показывает инициалы, а доступное имя содержит само имя', () => {
    seedPersisted('kinoshka:profile', 'Oleg Denisov')
    renderAvatar()

    const link = screen.getByRole('link', {
      name: 'Your profile: Oleg Denisov',
    })
    expect(link.textContent).toBe('OD')
  })

  it('несёт data-sentry-component: Sentry не читает aria-label (с именем) для такого элемента', () => {
    seedPersisted('kinoshka:profile', 'Ada Lovelace')
    renderAvatar()

    expect(screen.getByRole('link')).toHaveAttribute(
      'data-sentry-component',
      'ProfileAvatar',
    )
  })

  // Тест выше проверяет только наличие атрибута, не то, что сериализатор Sentry его читает.
  // Вызвать настоящий htmlTreeAsString() нельзя: он живёт в @sentry/core, который не значится
  // прямой зависимостью и не поднят в корневой node_modules pnpm-дерева (импорт падает с
  // "Failed to resolve import"), а заводить зависимость ради одного теста непропорционально.
  // Поэтому читаем исходник сериализатора как текст и проверяем инвариант, на котором держится
  // защита: ветка `dataset.sentryComponent` стоит РАНЬШЕ чтения aria-label. Если апдейт SDK
  // переименует атрибут или поменяет порядок проверок, тест упадёт — и вторая линия защиты
  // (scrubProfileNameBreadcrumb/scrubProfileNameSpan, src/app/sentry.ts) станет единственной.
  it('установленный @sentry/core всё ещё отдаёт data-sentry-component раньше, чем читает aria-label', () => {
    const sources = import.meta.glob(
      '/node_modules/.pnpm/@sentry+core@*/node_modules/@sentry/core/build/esm/utils/browser.js',
      { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>
    const [source] = Object.values(sources)
    if (!source)
      throw new Error('исходник @sentry/core utils/browser.js не найден')

    const componentIdx = source.indexOf('dataset["sentryComponent"]')
    const ariaIdx = source.indexOf('"aria-label"')
    expect(componentIdx).toBeGreaterThan(-1)
    expect(ariaIdx).toBeGreaterThan(-1)
    expect(componentIdx).toBeLessThan(ariaIdx)
  })
})
