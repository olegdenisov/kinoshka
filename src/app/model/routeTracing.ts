import { action, effect, urlAtom } from '@reatom/core'
import * as Sentry from '@sentry/react'
import { matchRoutePattern } from '@shared/config'

/** Имя транзакции для пути вне ROUTE_PATTERNS — одно на все неизвестные пути. */
export const NOT_FOUND_SPAN_NAME = '<not-found>'

/** Имя транзакции по шаблону роута: `/movie/1` и `/movie/2` → `/movie/:id`. */
export const routeSpanName = (pathname: string): string =>
  matchRoutePattern(pathname) ?? NOT_FOUND_SPAN_NAME

const routeAttributes = (origin: string) => ({
  [Sentry.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: 'route' as const,
  [Sentry.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: origin,
})

// Спаны pageload/navigation создаются здесь, а не авто-инструментированием
// browserTracingIntegration (там они выключены, см. initSentry):
// - авто-navigation срабатывает на каждый pushState/replaceState со сменой URL, в том числе на
//   replace одного query на /search, и при этом завершает текущий pageload/navigation-спан;
//   отфильтровать это beforeStartSpan не может — он только меняет опции, но не отменяет спан;
// - переименование в beforeStartSpan SDK безусловно помечает источником `custom`, а не `route`.
// Navigation — на смену pathname (`/movie/1` → `/movie/2` тоже: это новая загрузка данных),
// смена только query спан не создаёт.
export const initRouteTracing = action(() => {
  // Без Sentry.init (dev, тесты, сборка без DSN) клиента нет — трейсинг не нужен.
  const client = Sentry.getClient()
  if (!client) return

  let prevPathname: string | null = null
  effect(() => {
    const { pathname, href } = urlAtom()
    if (pathname === prevPathname) return
    const isPageload = prevPathname === null
    prevPathname = pathname

    if (isPageload) {
      Sentry.startBrowserTracingPageLoadSpan(client, {
        name: routeSpanName(pathname),
        // Как у авто-pageload SDK: начало — от старта навигации браузера, а не от запуска модели.
        startTime: performance.timeOrigin / 1000,
        attributes: routeAttributes('auto.pageload.reatom'),
      })
      return
    }

    Sentry.startBrowserTracingNavigationSpan(
      client,
      {
        name: routeSpanName(pathname),
        attributes: routeAttributes('auto.navigation.reatom'),
      },
      { url: href },
    )
  }, 'routeTracing.sync')
}, 'routeTracing.init')
