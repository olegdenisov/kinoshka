// Должен оставаться первым импортом в файле — initSentry() (внутри sentry-bootstrap.ts) обязан
// выполниться раньше, чем ./app/providers (транзитивно) импортирует ./router и вызывает
// createBrowserRouter(...); иначе Sentry.wrapCreateBrowserRouter молча не оборачивает роутер
// (см. WHY-комментарий в src/app/sentry-bootstrap.ts). Следующий редактор: не переставляй этот
// импорт ниже других, даже если линтер/автосортировка это не поймает.
import './app/sentry-bootstrap'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './app/styles/global.css'
import { Providers } from './app/providers'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
)
