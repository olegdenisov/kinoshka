import { useState } from 'react'
import { Link } from 'react-router'
import { MobileHeader, BottomNav } from '@widgets/mobile-chrome'
import { MovieRailMobile } from '@widgets/movie-rail'
import { SearchIcon } from '../../../shared/ui/Icon'
import { CATALOG } from '@entities/movie'

export const HomeMobile = () => {
  const [activeFilter, setActiveFilter] = useState('all')

  const chips = [
    { key: 'all', label: 'All' },
    { key: 'movies', label: 'Movies' },
    { key: 'series', label: 'Series' },
    { key: 'anime', label: 'Anime' },
  ]

  const sections = [
    {
      title: 'Popular this week',
      subtitle: 'Watching now',
      items: CATALOG.slice(0, 8),
    },
    {
      title: 'Trending series',
      subtitle: 'Binge-worthy',
      items: CATALOG.filter(m => m.type === 'tv-series')
        .concat(CATALOG.slice(0, 4))
        .slice(0, 8),
    },
    {
      title: 'Top anime',
      subtitle: 'Hand-picked',
      items: CATALOG.filter(m => m.type === 'anime')
        .concat(CATALOG.slice(4, 8))
        .slice(0, 8),
    },
    { title: 'For you', subtitle: 'Personal', items: CATALOG.slice(6, 14) },
  ]

  return (
    <div
      style={{
        background: '#0F0D11',
        color: '#F2F0EF',
        minHeight: '100vh',
        paddingBottom: 80,
      }}
    >
      <MobileHeader />

      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `
              radial-gradient(ellipse 80% 80% at 30% 20%, oklch(0.35 0.1 30 / 0.5), transparent 60%),
              radial-gradient(ellipse 60% 60% at 80% 40%, oklch(0.3 0.08 220 / 0.3), transparent 60%)
            `,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, transparent 50%, #0F0D11 100%)',
            }}
          />
        </div>

        <div
          style={{
            position: 'relative',
            padding: '32px 20px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 10px 5px 7px',
              borderRadius: 999,
              background: 'rgba(24,22,27,0.7)',
              border: '1px solid rgba(184,173,171,0.12)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#B8ADAB',
              alignSelf: 'flex-start',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: '#D18E5F',
                boxShadow: '0 0 0 3px rgba(209,142,95,0.18)',
              }}
            />
            <span>148,230 titles</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 40,
              lineHeight: 1,
              letterSpacing: '-0.035em',
              fontWeight: 500,
              margin: 0,
            }}
          >
            What do you{' '}
            <em
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                color: '#D18E5F',
                fontWeight: 400,
              }}
            >
              want
            </em>{' '}
            to watch<span style={{ color: '#D18E5F' }}>?</span>
          </h1>

          <Link
            to='/search'
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 48,
              padding: '0 14px',
              background: '#18161B',
              border: '1px solid rgba(184,173,171,0.15)',
              borderRadius: 8,
              color: '#5A5059',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <SearchIcon size={16} />
            <span>Search films, series, anime…</span>
          </Link>

          <div
            className='hide-scrollbar'
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              margin: '0 -20px',
              padding: '0 20px',
            }}
          >
            {chips.map(c => (
              <button
                type='button'
                key={c.key}
                onClick={() => setActiveFilter(c.key)}
                style={{
                  flexShrink: 0,
                  height: 32,
                  padding: '0 14px',
                  background:
                    activeFilter === c.key
                      ? 'rgba(209,142,95,0.15)'
                      : 'rgba(24,22,27,0.6)',
                  color: activeFilter === c.key ? '#D18E5F' : '#F2F0EF',
                  border: `1px solid ${activeFilter === c.key ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.12)'}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 500,
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 36,
          paddingBottom: 20,
        }}
      >
        {sections.map((s, i) => (
          <MovieRailMobile
            key={i}
            title={s.title}
            subtitle={s.subtitle}
            items={s.items}
          />
        ))}
      </div>

      <BottomNav active='home' />
    </div>
  )
}
