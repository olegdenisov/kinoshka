import { useState } from "react"
import { useNavigate } from "react-router"
import type { CastMember, MovieDetail, MovieImage } from "@entities/movie"
import { Poster, MobileCard, formatCurrency } from "@entities/movie"
import { MobileHeader, BottomNav } from "@widgets/mobile-chrome"
import {
  StarIcon,
  PlusIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
  PlayIcon,
} from "../../../shared/ui/Icon"

// В CastMember нет hue (в отличие от Movie) — фиксированный оттенок для градиента-заглушки,
// когда у персоны нет photo, по образцу статичного фолбэка в Poster.tsx (movie.hue ?? 20)
// и того же приёма в desktop-варианте (CastTab.tsx).
const FALLBACK_CAST_HUE = 220

// Совпадает с FALLBACK_SCREENSHOT_COUNT в desktop-варианте (MediaTab.tsx).
const FALLBACK_SCREENSHOT_COUNT = 8

type LikedState = {
  rate: boolean
  list: boolean
  watched: boolean
  fav: boolean
}

type TagPillMiniProps = React.PropsWithChildren

const TagPillMini = ({ children }: TagPillMiniProps) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: 20,
      padding: "0 7px",
      border: "1px solid rgba(184,173,171,0.15)",
      borderRadius: 3,
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      fontWeight: 500,
      letterSpacing: "0.1em",
    }}
  >
    {children}
  </span>
)

type MiniStatProps = {
  label: string
  value: string
  accent: string
}

const MiniStat = ({ label, value, accent }: MiniStatProps) => (
  <div style={{ textAlign: "center" }}>
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        color: "#92887F",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: "var(--font-display)",
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: "-0.02em",
        color: accent,
      }}
    >
      {value}
    </div>
  </div>
)

type MobileActionBtnProps = {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

const MobileActionBtn = ({
  icon,
  label,
  active,
  onClick,
}: MobileActionBtnProps) => {
  return (
    <button
      onClick={onClick}
      style={{
        height: 44,
        borderRadius: 8,
        background: active ? "rgba(209,142,95,0.12)" : "rgba(184,173,171,0.04)",
        color: active ? "#D18E5F" : "#F2F0EF",
        border: `1px solid ${active ? "rgba(209,142,95,0.35)" : "rgba(184,173,171,0.12)"}`,
        cursor: "pointer",
        fontFamily: "var(--font-body)",
        fontSize: 12.5,
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

type MovieMobileProps = {
  movie: MovieDetail
  images: MovieImage[]
}

export const MovieMobile = ({ movie, images }: MovieMobileProps) => {
  const navigate = useNavigate()
  const [tab, setTab] = useState("Overview")
  const [liked, setLiked] = useState<LikedState>({
    rate: false,
    list: false,
    watched: true,
    fav: false,
  })
  const related = movie.similarMovies.slice(0, 6)
  const tabs = ["Overview", "Cast", "Media", "Details"]

  return (
    <div
      style={{
        background: "#0F0D11",
        color: "#F2F0EF",
        minHeight: "100vh",
        paddingBottom: 90,
      }}
    >
      <MobileHeader
        onBack={() => navigate(-1)}
        showSearch={false}
        rightAction={
          <button
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: "rgba(184,173,171,0.06)",
              border: "1px solid rgba(184,173,171,0.1)",
              color: "#F2F0EF",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShareIcon />
          </button>
        }
      />

      <section style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          {movie.backdrop ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${movie.backdrop})`,
                backgroundSize: "cover",
                backgroundPosition: "center 20%",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: "-40px",
                background: `radial-gradient(ellipse 60% 60% at 30% 30%, oklch(0.32 0.1 ${movie.hue} / 0.6), transparent 70%), radial-gradient(ellipse 40% 50% at 75% 40%, oklch(0.28 0.08 ${movie.hue + 30} / 0.4), transparent 70%), #0F0D11`,
                filter: "blur(40px)",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(15,13,17,0.2) 0%, rgba(15,13,17,0.8) 70%, #0F0D11 100%)",
            }}
          />
        </div>

        <div style={{ position: "relative", padding: "20px 20px 28px" }}>
          <div
            style={{
              width: 200,
              margin: "0 auto 24px",
              boxShadow: "0 30px 50px -20px rgba(0,0,0,0.7)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <Poster movie={movie} showLabel={false} />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 14,
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#B8ADAB",
            }}
          >
            <TagPillMini>{movie.type}</TagPillMini>
            <TagPillMini>{movie.year}</TagPillMini>
            <TagPillMini>{movie.runtime}</TagPillMini>
            <TagPillMini>{movie.genre[0]}</TagPillMini>
          </div>

          <h1
            style={{
              margin: "0 0 6px",
              textAlign: "center",
              fontFamily: "var(--font-display)",
              fontSize: 32,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              fontWeight: 500,
            }}
          >
            {movie.title}
          </h1>
          <div
            style={{
              textAlign: "center",
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: 15,
              color: "#92887F",
              marginBottom: 20,
            }}
          >
            {movie.tagline}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginBottom: 20,
              padding: "14px 0",
              borderTop: "1px solid rgba(184,173,171,0.08)",
              borderBottom: "1px solid rgba(184,173,171,0.08)",
            }}
          >
            <MiniStat
              label="Users"
              value={movie.rating.toFixed(1)}
              accent="#E6B86A"
            />
            <MiniStat
              label="Critics"
              value={
                movie.criticScore != null
                  ? `${movie.criticScore.toFixed(0)}%`
                  : "—"
              }
              accent="#D7EEF3"
            />
            <MiniStat label="Yours" value="—" accent="#92887F" />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => setLiked((l) => ({ ...l, rate: !l.rate }))}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 8,
                background: "#D18E5F",
                color: "#0F0D11",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <StarIcon filled={liked.rate} size={14} />
              Rate
            </button>
            <button
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: "rgba(184,173,171,0.06)",
                border: "1px solid rgba(184,173,171,0.15)",
                color: "#F2F0EF",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlayIcon size={14} />
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            <MobileActionBtn
              icon={<PlusIcon />}
              label="Add"
              active={liked.list}
              onClick={() => setLiked((l) => ({ ...l, list: !l.list }))}
            />
            <MobileActionBtn
              icon={<EyeIcon />}
              label="Watched"
              active={liked.watched}
              onClick={() => setLiked((l) => ({ ...l, watched: !l.watched }))}
            />
            <MobileActionBtn
              icon={<HeartIcon filled={liked.fav} />}
              label="Favorite"
              active={liked.fav}
              onClick={() => setLiked((l) => ({ ...l, fav: !l.fav }))}
            />
          </div>
        </div>
      </section>

      <div
        className="hide-scrollbar"
        style={{
          position: "sticky",
          top: 52,
          zIndex: 10,
          background: "rgba(15,13,17,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(184,173,171,0.08)",
          display: "flex",
          overflowX: "auto",
          padding: "0 12px",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              position: "relative",
              flexShrink: 0,
              height: 46,
              padding: "0 14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: tab === t ? "#F2F0EF" : "#92887F",
              fontFamily: "var(--font-body)",
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            {t}
            <span
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                bottom: -1,
                height: 2,
                background: tab === t ? "#D18E5F" : "transparent",
              }}
            />
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 20px" }}>
        {tab === "Overview" && <MobileOverview m={movie} />}
        {tab === "Cast" && <MobileCast cast={movie.cast} />}
        {tab === "Media" && <MobileMedia m={movie} images={images} />}
        {tab === "Details" && <MobileDetailsContent m={movie} />}
      </div>

      {related.length > 0 && (
        <div
          style={{
            padding: "24px 0 20px",
            borderTop: "1px solid rgba(184,173,171,0.08)",
            marginTop: 8,
          }}
        >
          <div style={{ padding: "0 20px 14px" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                color: "#92887F",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              Similar titles
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}
            >
              More like this
            </h2>
          </div>
          <div
            className="hide-scrollbar"
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "140px",
              gap: 12,
              overflowX: "auto",
              padding: "0 20px",
            }}
          >
            {related.map((x) => (
              <MobileCard key={x.id} movie={x} />
            ))}
          </div>
        </div>
      )}

      <BottomNav active="search" />
    </div>
  )
}

type MobileOverviewProps = {
  m: MovieDetail
}

const MobileOverview = ({ m }: MobileOverviewProps) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "#92887F",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Synopsis
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "#F2F0EF",
            letterSpacing: "-0.003em",
          }}
        >
          {m.synopsis}
        </p>
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "#92887F",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Genres
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {m.genre.map((g) => (
            <span
              key={g}
              style={{
                height: 26,
                padding: "0 10px",
                display: "inline-flex",
                alignItems: "center",
                background: "rgba(184,173,171,0.06)",
                border: "1px solid rgba(184,173,171,0.12)",
                borderRadius: 4,
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "#B8ADAB",
              }}
            >
              {g}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "#92887F",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Countries
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "#F2F0EF",
          }}
        >
          {m.countries.length > 0 ? m.countries.join(" · ") : "—"}
        </p>
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "#92887F",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Ratings
        </div>
        {[
          ["Kinopoisk", m.ratingKp != null ? m.ratingKp.toFixed(1) : "—"],
          ["IMDb", m.ratingImdb != null ? m.ratingImdb.toFixed(1) : "—"],
          ["MPAA", m.ratingMpaa ?? "—"],
        ].map(([l, v]) => (
          <div
            key={l}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid rgba(184,173,171,0.08)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "#92887F",
              }}
            >
              {l}
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 500,
                color: "#F2F0EF",
              }}
            >
              {v}
            </span>
          </div>
        ))}
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "#92887F",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Crew
        </div>
        {m.crew.map((c) => (
          // ключ — не просто c.id: один человек может встречаться в persons несколько раз
          // с разными профессиями (напр. и режиссёр, и сценарист) — id одинаковый.
          <div
            key={`${c.id}-${c.profession}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid rgba(184,173,171,0.08)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "#92887F",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {c.profession}
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13.5,
                color: "#F2F0EF",
              }}
            >
              {c.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

type MobileCastProps = {
  cast: CastMember[]
}

const MobileCast = ({ cast }: MobileCastProps) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
      }}
    >
      {cast.map((c) => (
        // ключ — не просто c.id: Kinopoisk может отдать одну и ту же персону дважды в
        // persons (напр. актёр в двух ролях/дубляже) — id одинаковый, role разная.
        <div
          key={`${c.id}-${c.role}`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            textAlign: "center",
          }}
        >
          {c.photo ? (
            <img
              src={c.photo}
              alt={c.name}
              style={{
                display: "block",
                width: "100%",
                aspectRatio: "1",
                borderRadius: 999,
                border: "1px solid rgba(184,173,171,0.1)",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                aspectRatio: "1",
                borderRadius: 999,
                background: `linear-gradient(145deg, oklch(0.35 0.06 ${FALLBACK_CAST_HUE}), oklch(0.15 0.03 ${FALLBACK_CAST_HUE + 20}))`,
                border: "1px solid rgba(184,173,171,0.1)",
              }}
            />
          )}
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 12.5,
                fontWeight: 500,
                color: "#F2F0EF",
                letterSpacing: "-0.01em",
              }}
            >
              {c.name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                color: "#92887F",
                letterSpacing: "0.04em",
                marginTop: 2,
              }}
            >
              as {c.role}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

type MobileMediaProps = {
  m: MovieDetail
  images: MovieImage[]
}

const MobileMedia = ({ m, images }: MobileMediaProps) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          aspectRatio: "16/9",
          background: `linear-gradient(135deg, oklch(0.2 0.05 ${m.hue}), oklch(0.1 0.03 ${m.hue + 20}))`,
          border: "1px solid rgba(184,173,171,0.08)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {m.trailerUrl ? (
          <a
            href={m.trailerUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "#D18E5F",
              color: "#0F0D11",
              border: "none",
              cursor: "pointer",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 30px rgba(209,142,95,0.3)",
            }}
          >
            <PlayIcon size={18} />
          </a>
        ) : (
          <button
            disabled
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "#D18E5F",
              color: "#0F0D11",
              border: "none",
              cursor: "not-allowed",
              opacity: 0.4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 30px rgba(209,142,95,0.3)",
            }}
          >
            <PlayIcon size={18} />
          </button>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "#92887F",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Screenshots
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
        }}
      >
        {images.length > 0
          ? images.map((image) => (
              <img
                key={image.url}
                src={image.previewUrl ?? image.url}
                alt=""
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: "16/9",
                  border: "1px solid rgba(184,173,171,0.06)",
                  borderRadius: 4,
                  objectFit: "cover",
                }}
              />
            ))
          : Array.from({ length: FALLBACK_SCREENSHOT_COUNT }, (_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "16/9",
                  background: `linear-gradient(${135 + i * 20}deg, oklch(0.2 0.05 ${m.hue + i * 15}), oklch(0.1 0.03 ${m.hue}))`,
                  border: "1px solid rgba(184,173,171,0.06)",
                  borderRadius: 4,
                }}
              />
            ))}
      </div>
    </div>
  )
}

type MobileDetailsContentProps = {
  m: MovieDetail
}

const MobileDetailsContent = ({ m }: MobileDetailsContentProps) => {
  const rows = [
    { label: "Release date", value: m.premiereWorld ?? "—" },
    {
      label: "Country",
      value: m.countries.length > 0 ? m.countries.join(" · ") : "—",
    },
    { label: "Runtime", value: m.runtime },
    { label: "MPAA rating", value: m.ratingMpaa ?? "—" },
    {
      label: "Age rating",
      value: m.ageRating != null ? `${m.ageRating}+` : "—",
    },
    { label: "Budget", value: m.budget ? formatCurrency(m.budget) : "—" },
    {
      label: "Box office",
      value: m.feesWorld ? formatCurrency(m.feesWorld) : "—",
    },
  ]
  return (
    <div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "14px 0",
            borderBottom:
              i === rows.length - 1
                ? "none"
                : "1px solid rgba(184,173,171,0.08)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "#92887F",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {r.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13.5,
              color: "#F2F0EF",
            }}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}
