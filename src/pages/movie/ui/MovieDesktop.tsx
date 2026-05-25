import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Movie } from '../../../entities/movie/model/types'
import { Poster } from '../../../entities/movie/ui/Poster'
import { Card } from '../../../entities/movie/ui/Card'
import { Header } from '../../../widgets/header/ui/Header'
import { CATALOG, MOCK_DETAIL } from '../../../entities/movie/model/catalog'
import { StarIcon, PlusIcon, EyeIcon, HeartIcon, ShareIcon, PlayIcon } from '../../../shared/ui/Icon'
import { OverviewTab } from './tabs/OverviewTab'
import { CastTab } from './tabs/CastTab'
import { MediaTab } from './tabs/MediaTab'
import { DetailsTab } from './tabs/DetailsTab'

type LikedState = { rate: boolean; list: boolean; watched: boolean; fav: boolean }

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', border: '1px solid rgba(184,173,171,0.15)', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em' }}>{children}</span>
  )
}

function RatingBlock({ label, value, sub, accent, icon }: { label: string; value: string; sub: string; accent: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: accent }}>
        {icon}{value}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#5A5059', letterSpacing: '0.04em' }}>{sub}</div>
    </div>
  )
}

function PrimaryAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px',
      background: h ? '#B97A4F' : '#D18E5F', color: '#0F0D11', border: 'none', borderRadius: 5, cursor: 'pointer',
      fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em', transition: 'background 160ms',
    }}>{icon}{label}</button>
  )
}

function SecondaryAction({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 16px',
      background: active ? 'rgba(209,142,95,0.12)' : 'transparent',
      color: active ? '#D18E5F' : (h ? '#D7EEF3' : '#F2F0EF'),
      border: `1px solid ${active ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.2)'}`,
      borderRadius: 5, cursor: 'pointer',
      fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, letterSpacing: '-0.005em', transition: 'all 160ms',
    }}>{icon}{label}</button>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      position: 'relative', height: 52, padding: '0 20px',
      background: 'transparent', border: 'none', cursor: 'pointer',
      color: active ? '#F2F0EF' : (h ? '#F2F0EF' : '#92887F'),
      fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, letterSpacing: '-0.005em', transition: 'color 160ms',
    }}>
      {label}
      <span style={{ position: 'absolute', left: 16, right: 16, bottom: -1, height: 2, background: active ? '#D18E5F' : 'transparent', transition: 'background 160ms' }} />
    </button>
  )
}

export function MovieDesktop({ movie }: { movie: Movie }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('Overview')
  const [liked, setLiked] = useState<LikedState>({ rate: false, list: false, watched: true, fav: false })
  const related = CATALOG.filter((x) => x.id !== movie.id).slice(0, 6)
  const tabs = ['Overview', 'Cast', 'Media', 'Details']

  return (
    <div style={{ background: '#0F0D11', color: '#F2F0EF', minHeight: '100vh' }}>
      <Header activeNav="movie" />

      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <div style={{
            position: 'absolute', inset: '-40px',
            background: `radial-gradient(ellipse 50% 60% at 30% 30%, oklch(0.32 0.1 ${movie.hue} / 0.6), transparent 70%), radial-gradient(ellipse 40% 50% at 75% 40%, oklch(0.28 0.08 ${movie.hue + 30} / 0.4), transparent 70%), #0F0D11`,
            filter: 'blur(40px)',
          }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,13,17,0.3) 0%, rgba(15,13,17,0.7) 60%, #0F0D11 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'linear-gradient(to right, rgba(184,173,171,0.3) 1px, transparent 1px)', backgroundSize: '80px 100%' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1440, margin: '0 auto', padding: '40px 40px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40, fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#92887F' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Home</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/search')}>Catalog</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ color: '#B8ADAB' }}>{movie.title}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 48, alignItems: 'start' }}>
            <div style={{ position: 'relative', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.7)', borderRadius: 8, overflow: 'hidden' }}>
              <Poster movie={movie} showLabel={false} />
              <button style={{
                position: 'absolute', left: 16, bottom: 16,
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px 0 12px',
                background: 'rgba(15,13,17,0.8)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(184,173,171,0.2)', color: '#F2F0EF', borderRadius: 4, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                <PlayIcon size={10} />
                Trailer
              </button>
            </div>

            <div style={{ paddingTop: 4 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B8ADAB' }}>
                <TagPill>{movie.type}</TagPill>
                <TagPill>{movie.year}</TagPill>
                <TagPill>{movie.runtime}</TagPill>
                <TagPill>{movie.genre[0]}</TagPill>
              </div>

              <h1 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 72, lineHeight: 0.98, letterSpacing: '-0.035em', fontWeight: 500 }}>{movie.title}</h1>
              <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18, color: '#92887F', marginBottom: 32 }}>{MOCK_DETAIL.tagline}</div>

              <div style={{ display: 'flex', gap: 32, marginBottom: 32, padding: '20px 0', borderTop: '1px solid rgba(184,173,171,0.08)', borderBottom: '1px solid rgba(184,173,171,0.08)' }}>
                <RatingBlock label="Users" value={movie.rating.toFixed(1)} sub={`${MOCK_DETAIL.userVotes} votes`} accent="#E6B86A" icon={<StarIcon size={12} />} />
                <RatingBlock label="Critics" value={MOCK_DETAIL.criticScore} sub={`${MOCK_DETAIL.criticReviews} reviews`} accent="#D7EEF3" />
                <RatingBlock label="Your rating" value="—" sub="Not rated" accent="#92887F" />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
                <PrimaryAction icon={<StarIcon filled={liked.rate} size={14} />} label="Rate" active={liked.rate} onClick={() => setLiked((l) => ({ ...l, rate: !l.rate }))} />
                <SecondaryAction icon={<PlusIcon />} label="Add to list" active={liked.list} onClick={() => setLiked((l) => ({ ...l, list: !l.list }))} />
                <SecondaryAction icon={<EyeIcon />} label="Watched" active={liked.watched} onClick={() => setLiked((l) => ({ ...l, watched: !l.watched }))} />
                <SecondaryAction icon={<HeartIcon filled={liked.fav} />} label="Favorite" active={liked.fav} onClick={() => setLiked((l) => ({ ...l, fav: !l.fav }))} />
                <SecondaryAction icon={<ShareIcon />} label="Share" />
              </div>

              <p style={{ margin: 0, maxWidth: 640, fontFamily: 'var(--font-body)', fontSize: 15.5, lineHeight: 1.6, color: '#B8ADAB', letterSpacing: '-0.003em' }}>
                {MOCK_DETAIL.synopsis.split('\n')[0]}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div style={{ position: 'sticky', top: 68, zIndex: 10, background: 'rgba(15,13,17,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(184,173,171,0.08)' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 40px', display: 'flex', gap: 0 }}>
          {tabs.map((t) => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
        </div>
      </div>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '48px 40px' }}>
        {tab === 'Overview' && <OverviewTab m={movie} />}
        {tab === 'Cast' && <CastTab />}
        {tab === 'Media' && <MediaTab m={movie} />}
        {tab === 'Details' && <DetailsTab m={movie} />}
      </div>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px 40px 80px', borderTop: '1px solid rgba(184,173,171,0.08)', marginTop: 40 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Similar titles</div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>More like {movie.title}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 20 }}>
          {related.map((x) => <Card key={x.id} movie={x} variant="grid" onOpen={(m) => navigate(`/movie/${m.id}`)} />)}
        </div>
      </div>
    </div>
  )
}
