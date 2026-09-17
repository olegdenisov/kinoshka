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

    // [review phase 1] Изначальный regex был заякорен на начало строки (`^`/`m`-флаг) и матчил
    // только однострочные import'ы — многострочный `import {\n  Foo,\n} from '...'` не имеет
    // закрывающей кавычки на первой строке и молча выпал бы из результата, сдвигая индекс [0] на
    // следующий import без единой ошибки теста. Без `^`/`m`, но с "не-жадным" `[\s\S]*?` между
    // `import` и `from` (any-char, включая перевод строки) — матчит оба варианта одинаково, не
    // завися от того, уместился ли import в одну строку.
    const importPaths = [
      ...source.matchAll(/import\s+(?:'([^']+)'|[\s\S]*?\s+from\s+'([^']+)')/g),
    ].map(match => match[1] ?? match[2])

    expect(importPaths[0]).toBe('./app/sentry-bootstrap')
  })
})
