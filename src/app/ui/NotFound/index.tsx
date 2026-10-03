import { paths } from '@shared/config'

import s from './NotFound.module.css'

// Лежит в app, а не в pages: рендерится из routes.tsx для пути без роута, отдельного
// ленивого чанка ему не нужно.
export const NotFound = () => (
  <main className={s.wrap}>
    <p className={s.code}>404</p>
    <h1 className={s.title}>Page not found</h1>
    <p className={s.description}>This page doesn&apos;t exist or was moved.</p>
    <a className={s.homeLink} href={paths.home()}>
      Back to home
    </a>
  </main>
)
