import { useState } from "react"
import { useNavigate } from "react-router"
import { SearchIcon } from "@shared/ui"
import s from "./HeroSection.module.css"

const CHIPS = [
  { key: "all", label: "Everything" },
  { key: "movies", label: "Movies" },
  { key: "series", label: "Series" },
  { key: "anime", label: "Anime" },
]

type ChipProps = React.PropsWithChildren<{
  active: boolean
  onClick: () => void
}>

const Chip = ({ children, active, onClick }: ChipProps) => (
  <button
    onClick={onClick}
    className={`${s.chip}${active ? ` ${s.chipActive}` : ""}`}
  >
    {children}
  </button>
)

type StatProps = {
  value: string
  label: string
}

const Stat = ({ value, label }: StatProps) => (
  <div className={s.stat}>
    <div className={s.statValue}>{value}</div>
    <div className={s.statLabel}>{label}</div>
  </div>
)

export const HeroSection = () => {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState("all")
  const [q, setQ] = useState("")

  return (
    <section className={s.hero}>
      <div className={s.background}>
        <div className={s.backgroundGradient} />
        <div className={s.backgroundGrid} />
        <div className={s.backgroundFade} />
      </div>

      <div className={s.content}>
        <div className={s.badge}>
          <span className={s.badgeDot} />
          <span>Catalog · 148,230 titles</span>
        </div>

        <h1 className={s.heading}>
          What do you <em className={s.headingAccent}>want</em> to watch
          <span className={s.headingPunct}>?</span>
        </h1>

        <p className={s.description}>
          A quiet place to track films, series and anime — without the noise.
          Rate. Keep lists. Come back.
        </p>

        <div className={s.searchBar}>
          <SearchIcon size={18} />
          <input
            className={s.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") navigate("/search")
            }}
            placeholder='Try "films from 2024 rated 8+" or a title…'
          />
          <button className={s.searchBtn} onClick={() => navigate("/search")}>
            Search
          </button>
        </div>

        <div className={s.chips}>
          {CHIPS.map((c) => (
            <Chip
              key={c.key}
              active={activeFilter === c.key}
              onClick={() => setActiveFilter(c.key)}
            >
              {c.label}
            </Chip>
          ))}
        </div>

        <div className={s.stats}>
          <Stat value="148,230" label="Titles" />
          <Stat value="2.4M" label="Ratings" />
          <Stat value="480k" label="Watchers" />
          <Stat value="12,400" label="Updates / wk" />
        </div>
      </div>
    </section>
  )
}
