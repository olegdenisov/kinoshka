export const Footer = () => {
  return (
    <footer style={{ borderTop: '1px solid rgba(184,173,171,0.08)', padding: '48px 40px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12 }}>
            <span style={{ color: '#F2F0EF' }}>kino</span>
            <span style={{ color: '#D18E5F' }}>·</span>
            <span style={{ color: '#F2F0EF' }}>shka</span>
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: '#92887F', lineHeight: 1.55, maxWidth: 240 }}>
            A quiet place to track films, series, and anime.
          </p>
        </div>
        {[
          { h: 'Catalog', items: ['Movies', 'Series', 'Anime', 'Documentaries', 'New releases'] },
          { h: 'Account', items: ['My lists', 'Watched', 'Ratings', 'Recommendations'] },
          { h: 'About', items: ['Manifesto', 'Changelog', 'Contact', 'Press'] },
        ].map((col) => (
          <div key={col.h}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>{col.h}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.items.map((i) => (
                <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: '#B8ADAB', cursor: 'pointer' }}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 24, borderTop: '1px solid rgba(184,173,171,0.08)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#5A5059', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        <span>© 2026 Kinoshka</span>
        <span>Made with care, not noise</span>
      </div>
    </footer>
  )
};