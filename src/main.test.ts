import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = __dirname

// Не рендерим main.tsx напрямую — потребовало бы мокать react-dom/client и
// document.getElementById('root') (null в jsdom) ради инварианта, который проще и надёжнее
// проверить статически, по прецеденту vercel-headers.test.ts (читает index.html, а не рендерит
// его). Здесь читаем исходный текст файла и проверяем, что первый import-путь —
// './app/sentry-bootstrap', то есть initSentry() гарантированно выполнится раньше, чем
// ./app/providers транзитивно импортирует ./router (см. WHY-комментарии в src/main.tsx и
// src/app/sentry-bootstrap.ts).
describe('src/main.tsx', () => {
  it('первый import в файле — ./app/sentry-bootstrap', () => {
    const source = readFileSync(path.join(ROOT, 'main.tsx'), 'utf-8')

    const importPaths = [
      ...source.matchAll(/^import\s+(?:.*?\s+from\s+)?'([^']+)'/gm),
    ].map(match => match[1])

    expect(importPaths[0]).toBe('./app/sentry-bootstrap')
  })
})
