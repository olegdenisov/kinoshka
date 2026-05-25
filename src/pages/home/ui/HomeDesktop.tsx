import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Header } from '../../../widgets/header/ui/Header'
import { MovieRail } from '../../../widgets/movie-rail/ui/MovieRail'
import { SearchIcon } from '../../../shared/ui/Icon'
import { CATALOG } from '../../../entities/movie/model/catalog'

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: 32, padding: '0 14px',
        background: active ? 'rgba(209,142,95,0.15)' : (h ? 'rgba(184,173,171,0.08)' : 'rgba(24,22,27,0.6)'),
        color: active ? '#D18E5F' : '#F2F0EF',
        border: `1px solid ${active ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.12)'}`,
        borderRadius: 999, cursor: 'pointer',
        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
        letterSpacing: '-0.005em', transition: 'all 160ms',
      }}
    >{children}</button>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: '#F2F0EF', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function Footer() {
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
}

export function HomeDesktop() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('all')
  const [q, setQ] = useState('')

  const chips = [
    { key: 'all', label: 'Everything' },
    { key: 'movies', label: 'Movies' },
    { key: 'series', label: 'Series' },
    { key: 'anime', label: 'Anime' },
  ]

  const sections = [
    { title: 'Popular this week', subtitle: 'What everyone is watching', items: CATALOG.slice(0, 7) },
    { title: 'Trending series', subtitle: 'Binge-worthy', items: CATALOG.filter((m) => m.type === 'series').concat(CATALOG.slice(0, 3)).slice(0, 7) },
    { title: 'Top anime', subtitle: 'Hand-picked', items: CATALOG.filter((m) => m.type === 'anime').concat(CATALOG.slice(4, 8)).slice(0, 7) },
    { title: 'Because you watched "Orbit of Silence"', subtitle: 'Personal', items: CATALOG.slice(6, 14) },
  ]

  return (
    <div style={{ background: '#0F0D11', color: '#F2F0EF', minHeight: '100vh' }}>
      <Header activeNav="home" />

      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `
              radial-gradient(ellipse 60% 80% at 20% 20%, oklch(0.35 0.1 30 / 0.45), transparent 60%),
              radial-gradient(ellipse 50% 70% at 80% 30%, oklch(0.32 0.08 220 / 0.25), transparent 60%),
              radial-gradient(ellipse 80% 60% at 50% 100%, oklch(0.12 0.02 20), transparent 80%)
            `,
          }} />
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.12,
            backgroundImage: `
              linear-gradient(to right, rgba(184,173,171,0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(184,173,171,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            maskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, black, transparent)',
          }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, #0F0D11 100%)' }} />
        </div>

        <div style={{
          position: 'relative', zIndex: 1,
          maxWidth: 1440, margin: '0 auto', padding: '120px 40px 140px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '6px 12px 6px 8px', borderRadius: 999,
            background: 'rgba(24,22,27,0.7)', border: '1px solid rgba(184,173,171,0.12)',
            fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#B8ADAB',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#D18E5F', boxShadow: '0 0 0 4px rgba(209,142,95,0.18)' }} />
            <span>Catalog · 148,230 titles</span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 82, lineHeight: 0.98,
            letterSpacing: '-0.035em', fontWeight: 500, margin: 0,
            textAlign: 'center', maxWidth: 900, color: '#F2F0EF',
          }}>
            What do you <em style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: '#D18E5F', fontWeight: 400 }}>want</em> to watch<span style={{ color: '#D18E5F' }}>?</span>
          </h1>

          <p style={{ margin: 0, maxWidth: 540, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.55, color: '#B8ADAB', letterSpacing: '-0.005em' }}>
            A quiet place to track films, series and anime — without the noise. Rate. Keep lists. Come back.
          </p>

          <div
            style={{
              width: '100%', maxWidth: 640, display: 'flex', alignItems: 'center', gap: 12,
              height: 56, padding: '0 18px', background: '#18161B',
              border: '1px solid rgba(184,173,171,0.15)', borderRadius: 8, transition: 'all 200ms',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#D18E5F'
              e.currentTarget.style.boxShadow = '0 0 0 4px rgba(209,142,95,0.12)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(184,173,171,0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            tabIndex={-1}
          >
            <SearchIcon size={18} />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate('/search') }}
              placeholder='Try "films from 2024 rated 8+" or a title…'
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#F2F0EF', fontFamily: 'var(--font-body)', fontSize: 15.5, letterSpacing: '-0.005em' }}
            />
            <button
              onClick={() => navigate('/search')}
              style={{
                height: 36, padding: '0 14px', background: '#D18E5F', color: '#0F0D11',
                border: 'none', borderRadius: 5, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                transition: 'background 160ms',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#B97A4F' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#D18E5F' }}
            >Search</button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {chips.map((c) => (
              <Chip key={c.key} active={activeFilter === c.key} onClick={() => setActiveFilter(c.key)}>{c.label}</Chip>
            ))}
          </div>

          <div style={{
            display: 'flex', gap: 48, marginTop: 32, paddingTop: 24,
            borderTop: '1px solid rgba(184,173,171,0.08)',
            width: '100%', maxWidth: 640, justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', color: '#92887F',
          }}>
            <Stat value="148,230" label="Titles" />
            <Stat value="2.4M" label="Ratings" />
            <Stat value="480k" label="Watchers" />
            <Stat value="12,400" label="Updates / wk" />
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '40px 40px 80px' }}>
        {sections.map((s, i) => (
          <MovieRail key={i} title={s.title} subtitle={s.subtitle} items={s.items} />
        ))}
      </div>

      <Footer />
    </div>
  )
}
