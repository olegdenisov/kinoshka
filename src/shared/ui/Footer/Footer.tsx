import s from './Footer.module.css'

export const Footer = () => {
  return (
    <footer className={s.footer}>
      <div className={s.grid}>
        <div>
          <div className={s.logo}>
            <span className={s.logoMain}>kino</span>
            <span className={s.logoDot}>·</span>
            <span className={s.logoMain}>shka</span>
          </div>
          <p className={s.tagline}>A quiet place to track films, series, and anime.</p>
        </div>
        {[
          {
            h: 'Catalog',
            items: ['Movies', 'Series', 'Anime', 'Documentaries', 'New releases'],
          },
          {
            h: 'Account',
            items: ['My lists', 'Watched', 'Ratings', 'Recommendations'],
          },
          { h: 'About', items: ['Manifesto', 'Changelog', 'Contact', 'Press'] },
        ].map(col => (
          <div key={col.h}>
            <div className={s.colHeader}>{col.h}</div>
            <ul className={s.colList}>
              {col.items.map(item => (
                <li key={item} className={s.colItem}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={s.bottom}>
        <span>© 2026 Kinoshka</span>
        <span>Made with care, not noise</span>
      </div>
    </footer>
  )
}
