import { useRef } from 'react'
import { useNavigate } from 'react-router'
import { useState } from 'react'
import type { Movie } from '../../../entities/movie/model/types'
import { Card } from '../../../entities/movie/ui/Card'
import { MobileCard } from '../../../entities/movie/ui/MobileCard'

type MovieRailProps = {
  title: string
  subtitle: string
  items: Movie[]
  mobile?: boolean
}

function ArrowBtn({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: 36, height: 36, borderRadius: 999,
        background: h ? 'rgba(209,142,95,0.12)' : 'transparent',
        border: `1px solid ${h ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.15)'}`,
        color: h ? '#D18E5F' : '#B8ADAB', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 160ms',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

export function MovieRail({ title, subtitle, items, mobile = false }: MovieRailProps) {
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 480, behavior: 'smooth' })
  }

  const openMovie = (movie: Movie) => navigate(`/movie/${movie.id}`)

  if (mobile) {
    return (
      <section>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          padding: '0 20px 14px',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9.5,
              color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase',
              marginBottom: 3,
            }}>{subtitle}</div>
            <h2 style={{
              margin: 0, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500,
              letterSpacing: '-0.02em', color: '#F2F0EF',
            }}>{title}</h2>
          </div>
          <button
            onClick={() => navigate('/search')}
            style={{
              background: 'transparent', border: 'none', color: '#D18E5F',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', cursor: 'pointer',
            }}
          >See all →</button>
        </div>
        <div
          className="hide-scrollbar"
          style={{
            display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '140px',
            gap: 12, overflowX: 'auto', padding: '0 20px 4px',
            scrollSnapType: 'x mandatory',
          }}
        >
          {items.map((m) => (
            <div key={m.id} style={{ scrollSnapAlign: 'start' }}>
              <MobileCard movie={m} onOpen={openMovie} />
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section style={{ marginBottom: 64 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>{subtitle}</div>
          <h2
            onClick={() => navigate('/search')}
            style={{
              margin: 0, cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500,
              letterSpacing: '-0.02em', color: '#F2F0EF',
            }}
          >
            {title}
            <span style={{
              display: 'inline-block', marginLeft: 10,
              fontFamily: 'var(--font-mono)', fontSize: 13,
              color: '#D18E5F', letterSpacing: '0.06em',
            }}>→</span>
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <ArrowBtn dir="left" onClick={() => scroll(-1)} />
          <ArrowBtn dir="right" onClick={() => scroll(1)} />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="hide-scrollbar"
        style={{
          display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '200px',
          gap: 20, overflowX: 'auto', paddingBottom: 8,
        }}
      >
        {items.map((m) => (
          <Card key={m.id} movie={m} variant="compact" onOpen={openMovie} />
        ))}
      </div>
    </section>
  )
}
