import * as Sentry from '@sentry/react'
import { PROFILE_ARIA_LABEL_PREFIX, setStorageErrorReporter } from '@shared/lib'
import type { StorageErrorReporter } from '@shared/lib'
import { useEffect } from 'react'
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router'

import { SENTRY_TRACES_SAMPLE_RATE } from '../../sentry.config'

// Defense-in-depth: `X-API-KEY` (см. src/shared/api/client.ts) не должен попасть в Sentry, если
// когда-нибудь окажется в request-контексте события. При sendDefaultPii: false (дефолт SDK,
// зафиксирован явно в initSentry) браузерный SDK сам не прикладывает заголовки запроса к
// событию — так что это подстраховка на случай будущей интеграции/ручного контекста, а не
// закрытие уже существующей дыры.
export const scrubApiKeyHeader = (
  event: Sentry.ErrorEvent,
): Sentry.ErrorEvent => {
  const headers = event.request?.headers
  if (!headers) return event

  const scrubbedHeaders = { ...headers }
  delete scrubbedHeaders['X-API-KEY']
  delete scrubbedHeaders['x-api-key']

  return {
    ...event,
    request: {
      ...event.request,
      headers: scrubbedHeaders,
    },
  }
}

// Подстановка вместо отброшенного хвоста имени — см. scrubProfileNameFromText ниже.
const REDACTED_NAME = '[redacted]'

// Общий хвост для скраба breadcrumb-сообщения и span-атрибута/description. Имя может содержать
// кавычки, `]` и ` > `, так что точную границу значения не найти по самому имени — как и раньше,
// всё после префикса отбрасывается целиком. Раньше здесь взамен безусловно дописывался
// фиксированный суффикс `Your profile"]`, как будто отброшенный хвост всегда имел форму
// `[aria-label="..."]` — для строки, пришедшей не из htmlTreeAsString (например, будущий span,
// копирующий сырое значение aria-label напрямую, без окружающего селектора), это давало битую
// строку с висящими кавычкой и скобкой. REDACTED_NAME ничего не утверждает о форме отброшенного
// хвоста и поэтому корректен для любого источника строки.
const scrubProfileNameFromText = (value: string): string | null => {
  const start = value.indexOf(PROFILE_ARIA_LABEL_PREFIX)
  if (start === -1) return null

  return `${value.slice(0, start)}${PROFILE_ARIA_LABEL_PREFIX}${REDACTED_NAME}`
}

// PII: имя из профиля (`@features/profile`) попадает в aria-label аватара (`Your profile: <name>`).
// Встроенный breadcrumbs-integration Sentry на клик сериализует цепочку DOM-элементов через
// htmlTreeAsString, а `_htmlElementAsString` безусловно дописывает `[aria-label="..."]` (см.
// @sentry/core utils/browser.js) — без этого скраба введённое пользователем имя ушло бы в
// сторонний сервис в `ui.click`-крошке любого последующего события. sendDefaultPii: false и
// scrubApiKeyHeader это не закрывают: первый про IP/куки/заголовки, второй трогает только
// event.request.headers. PROFILE_ARIA_LABEL_PREFIX (`@shared/lib`) — общая константа с aria-label
// из ProfileAvatar.tsx, а не два независимых литерала — см. её докблок. Там же на аватаре стоит
// data-sentry-component: сериализатор для элемента с этим атрибутом возвращает только его
// значение и aria-label не читает вовсе — это первая и настоящая линия защиты для breadcrumb'ов
// (ProfileAvatar — единственный элемент с этим aria-label). Скраб ниже — вторая линия защиты
// именно для breadcrumb'ов (`beforeBreadcrumb` их и только их обрабатывает), на случай нового
// элемента с тем же aria-label без data-sentry-component; он НЕ защищает span'ы/транзакции —
// см. scrubProfileNameSpan ниже для этого отдельного пути утечки.
export const scrubProfileNameBreadcrumb = (
  breadcrumb: Sentry.Breadcrumb,
): Sentry.Breadcrumb => {
  const { message } = breadcrumb
  if (typeof message !== 'string') return breadcrumb

  const scrubbed = scrubProfileNameFromText(message)
  if (scrubbed === null) return breadcrumb

  return { ...breadcrumb, message: scrubbed }
}

// SpanJSON — тип параметра beforeSendSpan — не входит в публичный набор типов, ре-экспортируемых
// @sentry/react/@sentry/browser (только явный список: Breadcrumb, ErrorEvent и т.п., см.
// browser/build/npm/types/exports.d.ts); @sentry/core, где SpanJSON объявлен, не значится в
// package.json как прямая зависимость и не поднят в корневой node_modules этим pnpm-деревом.
// Тип параметра выводим из самого Sentry.init(...) — NonNullable<...>['beforeSendSpan'] — вместо
// прямого импорта SpanJSON, чтобы не заводить недекларированную зависимость на @sentry/core ради
// одной сигнатуры.
type BeforeSendSpan = NonNullable<
  NonNullable<Parameters<typeof Sentry.init>[0]>['beforeSendSpan']
>

// Будущее-ориентированная защита, не закрытие живой утечки: с tracesSampleRate > 0 браузерный
// SDK шлёт отдельные span'ы для Web Vitals (@sentry/browser-utils: inp.js/webVitalSpans.js/
// cls.js/browserMetrics.js), где имя/атрибуты элемента-цели тоже строятся через
// htmlTreeAsString — тот же путь, что и у breadcrumb-сообщения выше, но beforeBreadcrumb его не
// видит (он обрабатывает только breadcrumbs). Сегодня живой утечки нет: data-sentry-component
// на ProfileAvatar перехватывает сериализацию раньше, чем сериализатор дойдёт до aria-label, на
// каждом из этих путей — проверено по исходникам @sentry/browser-utils 10.71.0. beforeSendSpan
// (span.description + произвольные строковые атрибуты span.data, включая элементы
// массивов-атрибутов — SpanAttributeValue допускает Array<string | null | undefined>, см.
// @sentry/core SpanAttributes) — тот же скраб на случай, если это когда-нибудь перестанет быть
// так (новый элемент без data-sentry-component, апдейт SDK, меняющий порядок проверок
// сериализатора). span.links (SpanLinkJSON[]) скраб не трогает — сегодня ни один известный
// путь не кладёт туда сериализованный DOM-селектор с aria-label; пересмотреть, если появится.
export const scrubProfileNameSpan: BeforeSendSpan = span => {
  const description =
    typeof span.description === 'string'
      ? (scrubProfileNameFromText(span.description) ?? span.description)
      : span.description

  const data = { ...span.data }
  let dataChanged = false
  for (const [attrKey, attrValue] of Object.entries(data)) {
    if (typeof attrValue === 'string') {
      const scrubbed = scrubProfileNameFromText(attrValue)
      if (scrubbed === null) continue
      data[attrKey] = scrubbed
      dataChanged = true
      continue
    }

    if (!Array.isArray(attrValue)) continue
    let arrayChanged = false
    const scrubbedArray = attrValue.map(item => {
      if (typeof item !== 'string') return item
      const scrubbed = scrubProfileNameFromText(item)
      if (scrubbed === null) return item
      arrayChanged = true
      return scrubbed
    })
    if (!arrayChanged) continue
    // SpanAttributeValue — union трёх однородных массивов (string[] | number[] | boolean[]), не
    // единый смешанный тип: TS не выводит из `Array<X | Y | Z>.map` обратно узкий union без
    // явного каста — элементы этого конкретного массива остаются string | null | undefined по
    // построению (см. цикл выше), так что каст безопасен.
    data[attrKey] = scrubbedArray as typeof attrValue
    dataChanged = true
  }

  if (description === span.description && !dataChanged) return span

  return { ...span, description, data }
}

// Репортер ошибок localStorage (createStorageSlot, @shared/lib) — раньше эти исключения
// (QuotaExceededError/SecurityError из тем/избранного/профиля в приватном режиме) долетали до
// Sentry сами через globalHandlersIntegration; try/catch вокруг localStorage их проглотил, так
// что без явной переотправки сюда отказ хранилища стал бы полностью невидимым в проде. captureException,
// не breadcrumb: это самостоятельное событие уровня warning, а не контекст для будущей ошибки —
// само хранилище содержимого (значение, которое не удалось записать) сюда не передаётся, только
// ключ/операция/исключение (см. StorageErrorContext, @shared/lib/storage/storage.ts).
const reportStorageErrorToSentry: StorageErrorReporter = ({
  key,
  operation,
  error,
}) => {
  Sentry.captureException(
    error instanceof Error ? error : new Error(String(error)),
    {
      level: 'warning',
      tags: { storageKey: key, storageOperation: operation },
    },
  )
}

// Явная функция, а не side-effect при импорте — тестируема с разными import.meta.env.PROD /
// VITE_SENTRY_DSN через vi.stubEnv. Изначально (план 20260905-sentry-error-tracking.md) скоуп
// был только error tracking, без integrations/tracesSampleRate — трейсинг (2.5.2) сознательно
// не включался из-за параметризованного роута /movie/:id (риск одного transaction на фильм).
// Task 2b (план 20260915-telemetry-dashboard-sentry-alerts.md) закрывает этот блокер через
// reactRouterBrowserTracingIntegration + wrapCreateBrowserRouter (см. router.tsx) — они вместе
// группируют параметризованные роуты в один transaction name.
//
// tracePropagationTargets НЕ передаётся: дефолт SDK матчит только same-origin/localhost, а все
// вызовы API идут на абсолютный кросс-origin https://api.poiskkino.dev — заголовки sentry-trace/
// baggage туда и так не уйдут при дефолте, расширять список смысла нет, пока не понадобится и не
// будет проверено живым запросом на CORS-совместимость стороннего API (см. план, Post-Completion).
export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!import.meta.env.PROD || !dsn) return

  Sentry.init({
    dsn,
    release: __APP_RELEASE__,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    beforeSend: scrubApiKeyHeader,
    beforeBreadcrumb: scrubProfileNameBreadcrumb,
    // scrubProfileNameSpan имеет сигнатуру (span: SpanJSON) => SpanJSON — путь для
    // traceLifecycle: 'static' (дефолт SDK, здесь не переопределяется). Если когда-нибудь
    // включат traceLifecycle: 'stream', эта функция перестанет вызываться вовсе (SDK ждёт
    // callback, обёрнутый через withStreamedSpan, с другой сигнатурой StreamedSpanJSON) —
    // скраб придётся переносить/оборачивать заново, а не просто оставлять как есть.
    beforeSendSpan: scrubProfileNameSpan,
    integrations: [
      Sentry.reactRouterBrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
  })

  setStorageErrorReporter(reportStorageErrorToSentry)
}
