import { StarIcon, PlusIcon, EyeIcon, HeartIcon, ShareIcon } from '@shared/ui'

import type { LikedState } from '../types'

import s from './MovieActions.module.css'

type PrimaryActionProps = {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

const PrimaryAction = ({ icon, label, onClick }: PrimaryActionProps) => (
  <button type='button' onClick={onClick} className={s.primaryBtn}>
    {icon}
    {label}
  </button>
)

type SecondaryActionProps = {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}

const SecondaryAction = ({
  icon,
  label,
  active,
  onClick,
}: SecondaryActionProps) => (
  <button
    type='button'
    onClick={onClick}
    aria-pressed={active}
    className={`${s.secondaryBtn}${active ? ` ${s.secondaryBtnActive}` : ''}`}
  >
    {icon}
    {label}
  </button>
)

type MovieActionsProps = {
  liked: LikedState
  onChange: (l: LikedState) => void
  watched: boolean
  onWatchedToggle: () => void
  inWatchlist: boolean
  onWatchlistToggle: () => void
  favorite: boolean
  onFavoriteToggle: () => void
}

export const MovieActions = ({
  liked,
  onChange,
  watched,
  onWatchedToggle,
  inWatchlist,
  onWatchlistToggle,
  favorite,
  onFavoriteToggle,
}: MovieActionsProps) => {
  return (
    <div className={s.actions}>
      <PrimaryAction
        icon={<StarIcon filled={liked.rate} size={14} />}
        label='Rate'
        onClick={() => onChange({ ...liked, rate: !liked.rate })}
      />
      <SecondaryAction
        icon={<PlusIcon />}
        label='Watchlist'
        active={inWatchlist}
        onClick={onWatchlistToggle}
      />
      <SecondaryAction
        icon={<EyeIcon />}
        label='Watched'
        active={watched}
        onClick={onWatchedToggle}
      />
      <SecondaryAction
        icon={<HeartIcon filled={favorite} />}
        label='Favorite'
        active={favorite}
        onClick={onFavoriteToggle}
      />
      <SecondaryAction icon={<ShareIcon />} label='Share' />
    </div>
  )
}
