import { action, top, urlAtom, withMiddleware } from '@reatom/core'
import { z } from 'zod'

const STORAGE_KEY = 'kinoshka:scroll-positions'
const RESTORE_TIMEOUT_MS = 1000
// Только пользовательский ввод: событие scroll шлёт и наш собственный scrollTo.
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown'] as const

const positionsSchema = z.record(z.string(), z.number())

type Session = {
  /** Ключ текущей записи истории — под ним сохраняется позиция при уходе с неё. */
  key: string
  listeners: AbortController
  cancelRestore: () => void
}

let session: Session | null = null

const createKey = () => Math.random().toString(36).slice(2, 10)

const readEntryKey = (): string | undefined => {
  const state: unknown = window.history.state
  if (typeof state !== 'object' || state === null || !('key' in state)) {
    return undefined
  }
  return typeof state.key === 'string' ? state.key : undefined
}

const stampEntryKey = (key: string) => {
  const state: unknown = window.history.state
  const base = typeof state === 'object' && state !== null ? state : {}
  window.history.replaceState({ ...base, key }, '')
}

const readPositions = (): Record<string, number> => {
  try {
    const parsed = positionsSchema.safeParse(
      JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}'),
    )
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

const savePosition = (key: string, y: number) => {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readPositions(), [key]: y }),
    )
  } catch {
    // Квота / приватный режим: позиция просто не восстановится.
  }
}

// Контент страницы (ленивый чанк, данные) дорастает не сразу, а браузер обрезает scrollTo по
// текущей высоте документа. Поэтому пробуем на каждом кадре, пока высоты не хватит; один
// критерий для страниц с loader и без него.
const restoreScroll = (s: Session, y: number) => {
  s.cancelRestore()
  const deadline = performance.now() + RESTORE_TIMEOUT_MS
  const controller = new AbortController()
  let frame = 0
  const stop = () => {
    cancelAnimationFrame(frame)
    controller.abort()
  }
  for (const type of USER_SCROLL_EVENTS) {
    window.addEventListener(type, stop, {
      signal: controller.signal,
      passive: true,
    })
  }
  const attempt = () => {
    const maxY = document.documentElement.scrollHeight - window.innerHeight
    if (maxY >= y || performance.now() >= deadline) {
      window.scrollTo(0, y)
      stop()
      return
    }
    frame = requestAnimationFrame(attempt)
  }
  frame = requestAnimationFrame(attempt)
  s.cancelRestore = stop
}

// Отложенно: urlAtom пишет в history через setTimeout(0) (а клик по ссылке — сразу после смены
// атома) и затирает state записи на `{}`. Наш таймер встаёт в очередь позже и проставляет ключ
// уже в итоговую запись.
const afterHistoryWrite = (s: Session, cb: () => void) => {
  setTimeout(() => {
    if (session === s) cb()
  }, 0)
}

const handleUrlChange = (prev: URL, next: URL, replace: boolean) => {
  const s = session
  if (!s) return

  // Позиция уходящей записи: страница ещё не перерисована.
  savePosition(s.key, window.scrollY)
  s.cancelRestore()

  // popstate: history уже стоит на целевой записи, а при push/replace через urlAtom запись в
  // history ещё впереди (клик тоже пишет после смены атома).
  if (window.location.href === next.href) {
    const key = readEntryKey()
    if (key === undefined) {
      const fresh = createKey()
      s.key = fresh
      afterHistoryWrite(s, () => stampEntryKey(fresh))
      return
    }
    s.key = key
    const y = readPositions()[key]
    if (y !== undefined) afterHistoryWrite(s, () => restoreScroll(s, y))
    return
  }

  const key = replace ? s.key : createKey()
  s.key = key
  // Смена только query (replace на /search) скролл не трогает: наверх по смене страницы
  // каталога прокручивает сама модель поиска.
  const scrollToTop = !replace && prev.pathname !== next.pathname
  afterHistoryWrite(s, () => {
    stampEntryKey(key)
    if (scrollToTop) window.scrollTo(0, 0)
  })
}

// Middleware, а не подписка: только здесь видны и прежний URL, и флаг replace, и момент до
// записи в history (по нему popstate отличается от навигации через urlAtom). urlAtom.sync не
// заменяется. Пока модель не запущена (session === null), middleware прозрачен.
urlAtom.extend(
  withMiddleware(() => (next, ...params) => {
    const prev = top().state as URL | null
    const result = next(...params)
    if (
      session &&
      params.length > 0 &&
      prev &&
      result &&
      result.href !== prev.href
    ) {
      handleUrlChange(prev, result, params[1] === true)
    }
    return result
  }),
)

/** Снимает слушатели и отменяет восстановление; модульное состояние вне атомов (тесты). */
export const resetScrollRestoration = () => {
  if (!session) return
  session.cancelRestore()
  session.listeners.abort()
  session = null
}

export const initScrollRestoration = action(() => {
  resetScrollRestoration()
  window.history.scrollRestoration = 'manual'
  // Первое чтение инициализирует urlAtom (слушатели popstate и кликов).
  urlAtom()

  const existingKey = readEntryKey()
  const key = existingKey ?? createKey()
  const s: Session = {
    key,
    listeners: new AbortController(),
    cancelRestore: () => {},
  }
  session = s
  if (existingKey === undefined) stampEntryKey(key)

  // Перезагрузка и возврат с чужого сайта: scrollRestoration = 'manual' отключает штатное
  // восстановление, поэтому позицию сохраняем при уходе со страницы и восстанавливаем здесь.
  window.addEventListener(
    'pagehide',
    () => savePosition(s.key, window.scrollY),
    { signal: s.listeners.signal },
  )
  const saved = existingKey === undefined ? undefined : readPositions()[key]
  if (saved !== undefined) restoreScroll(s, saved)
}, 'scrollRestoration.init')
