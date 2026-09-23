import type { z } from 'zod'

export type StorageSlot<T> = {
  get: () => T
  // true — значение записано; false — localStorage недоступен/переполнен (Safari private mode,
  // квота, заблокированные данные сайта). Возвращаемое значение необязательно к использованию:
  // прежние вызовы `(value) => void` продолжают работать без изменений.
  set: (value: T) => boolean
  remove: () => void
  subscribe: (callback: () => void) => () => void // возвращает unsubscribe
}

const emitter = new EventTarget()

export type StorageErrorContext = {
  key: string
  operation: 'get' | 'set' | 'remove'
  error: unknown
}

export type StorageErrorReporter = (context: StorageErrorContext) => void

// Раньше (до try/catch вокруг localStorage) исключения из get()/set() в обработчиках событий
// долетали до Sentry сами — через встроенный globalHandlersIntegration. Теперь catch-блоки их
// проглатывают молча: в приватном режиме браузера тема/избранное/профиль тихо перестают
// сохраняться навсегда без единого сигнала телеметрии. onErrorReporter — единственный способ
// вернуть это, не нарушая границу слоёв (@shared не может импортировать @app/Sentry напрямую):
// null по умолчанию (тесты и dev остаются тихими), src/app/sentry.ts подключает реальный
// репортер через setStorageErrorReporter(). Значение (само содержимое стора) сюда никогда не
// попадает — только key/operation/error. Один репортер на весь модуль, общий для всех слотов, а
// не аргумент createStorageSlot.
let onErrorReporter: StorageErrorReporter | null = null

export const setStorageErrorReporter = (
  reporter: StorageErrorReporter,
): void => {
  onErrorReporter = reporter
}

// Дедупликация по "operation:key" на весь сессионный lifetime модуля (не per-slot: тот же ключ
// может открываться несколькими createStorageSlot в разных местах, а событие одно и то же для
// пользователя) — иначе недоступное хранилище шлёт по событию на каждый рендер/попытку записи,
// заливая Sentry флудом одинаковых событий вместо одного сигнала "это здесь сломано". Пока репортер
// не подключен (onErrorReporter === null), бухгалтерию не ведём: сбой, случившийся до вызова
// initSentry() (он подключается в самом конце sentry-bootstrap.ts, gated на PROD+dsn), иначе
// навсегда пометился бы "уже отправлен", хотя фактически не ушёл никуда.
//
// По cooldown, не навсегда: хранит время последней отправки, а не сам факт "уже отправляли" —
// иначе один-единственный ранний сбой (например, кратковременный QuotaExceededError) помечал бы
// ключ отправленным до конца жизни SPA-сессии, и более поздний, уже другой по сути отказ того же
// ключа/операции (SecurityError после блокировки данных сайта пользователем) молча проглатывался
// бы без единого сигнала в Sentry. REPORT_COOLDOWN_MS — тот же принцип и тот же порядок величины,
// что и cooldown фоновой перезагрузки словаря жанров (60s, см. useGenreDictionary), не отдельное
// изобретение.
const REPORT_COOLDOWN_MS = 60_000
const lastReportedAt = new Map<string, number>()

const reportStorageError = (context: StorageErrorContext): void => {
  if (!onErrorReporter) return
  const dedupeKey = `${context.operation}:${context.key}`
  const last = lastReportedAt.get(dedupeKey)
  if (last !== undefined && Date.now() - last < REPORT_COOLDOWN_MS) return
  lastReportedAt.set(dedupeKey, Date.now())
  try {
    onErrorReporter(context)
  } catch {
    // Внешний репортер (например, Sentry.captureException) — публичный инжектируемый API,
    // не контролируемый этим файлом: его собственный сбой не должен ронять localStorage-слот,
    // из get()/getSnapshot — в рендер и дальше в GlobalErrorBoundary, из set() — в обработчик
    // события, который React 19 не маршрутизирует в error boundary.
  }
}

export const createStorageSlot = <T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): StorageSlot<T> => {
  // Мемо распарсенного значения по сырой строке из localStorage: get() —
  // getSnapshot для useSyncExternalStore, который требует референциальной
  // стабильности между вызовами без изменений в сторе (иначе React считает
  // снапшот каждый раз новым → бесконечный ре-рендер + dev-варнинг).
  let cachedRaw: string | null = null
  let cachedValue: T = fallback
  let hasCached = false

  // Общий сброс мемо распарсенного значения — единственное место, а не повторённые в get()/
  // remove()/set() пары `cachedRaw = null; hasCached = false`, которые до этого приходилось
  // синхронно менять в нескольких местах одной функции при любой правке того, что значит
  // "нет закэшированного значения".
  const resetCache = () => {
    cachedRaw = null
    hasCached = false
  }

  return {
    get() {
      // Доступ к localStorage может бросить (SecurityError при заблокированных данных сайта):
      // get() — getSnapshot первого рендера, исключение отсюда положило бы всё приложение
      // через GlobalErrorBoundary. Недоступное хранилище = пустое: отдаём fallback.
      let raw: string | null
      try {
        raw = localStorage.getItem(key)
      } catch (error) {
        // get() — это getSnapshot для useSyncExternalStore: React обязан мочь вызывать его
        // несколько раз за рендер (и дважды в StrictMode) как чистое чтение, без побочных
        // эффектов. reportStorageError зовёт внешний репортер (Sentry.captureException) —
        // откладываем вызов на микротаску, чтобы сам getSnapshot оставался синхронным и чистым.
        // set()/remove() не используются как getSnapshot — там репорт остаётся синхронным.
        queueMicrotask(() =>
          reportStorageError({ key, operation: 'get', error }),
        )
        resetCache()
        return fallback
      }
      if (raw === null) {
        resetCache()
        return fallback
      }
      if (hasCached && raw === cachedRaw) {
        return cachedValue
      }
      try {
        const parsed = schema.safeParse(JSON.parse(raw))
        cachedValue = parsed.success ? parsed.data : fallback
      } catch {
        cachedValue = fallback
      }
      cachedRaw = raw
      hasCached = true

      return cachedValue
    },
    remove() {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        // хранилище недоступно — удалять нечего
        reportStorageError({ key, operation: 'remove', error })
      }
      resetCache()
    },
    set(value: T) {
      // Не бросаем: обработчик события (Save и т.п.) в React 19 не попадает в error boundary,
      // исключение оставило бы кнопку «мёртвой» без единого сообщения. Вызывающий узнаёт об
      // отказе по false и сам решает, что показать; подписчиков при отказе не будим — стор не
      // изменился.
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch (error) {
        reportStorageError({ key, operation: 'set', error })
        return false
      }
      resetCache()
      // Уведомляем текущую вкладку. emitter — один общий EventTarget на все слоты (см.
      // модульную переменную выше), поэтому событие несёт key в detail — иначе set() на
      // одном слоте будил бы подписчиков всех остальных слотов в том же таб (лишние
      // ре-рендеры/срабатывания useSyncExternalStore на несвязанных ключах).
      emitter.dispatchEvent(new CustomEvent('change', { detail: { key } }))

      return true
    },
    subscribe(callback) {
      const localHandler = (e: Event) => {
        if ((e as CustomEvent<{ key: string }>).detail.key === key) callback()
      }
      const storageHandler = (e: StorageEvent) => {
        if (e.key === key) callback()
      }

      window.addEventListener('storage', storageHandler)
      emitter.addEventListener('change', localHandler)

      return () => {
        window.removeEventListener('storage', storageHandler)
        emitter.removeEventListener('change', localHandler)
      }
    },
  }
}
