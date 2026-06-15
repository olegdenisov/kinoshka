import { StarIcon, PlusIcon, EyeIcon, HeartIcon, ShareIcon } from '@shared/ui'
import type { LikedState } from '../MovieDesktop/types'
import s from './MovieActions.module.css'

type PrimaryActionProps = {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

const PrimaryAction = ({ icon, label, onClick }: PrimaryActionProps) => (
  <button onClick={onClick} className={s.primaryBtn}>{icon}{label}</button>
)

type SecondaryActionProps = {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}

const SecondaryAction = ({ icon, label, active, onClick }: SecondaryActionProps) => (
  <button onClick={onClick} className={`${s.secondaryBtn}${active ? ` ${s.secondaryBtnActive}` : ''}`}>{icon}{label}</button>
)

type MovieActionsProps = {
  liked: LikedState
  onChange: (l: LikedState) => void
}

export const MovieActions = ({ liked, onChange }: MovieActionsProps) => {
  return (
    <div className={s.actions}>
      <PrimaryAction icon={<StarIcon filled={liked.rate} size={14} />} label="Rate" onClick={() => onChange({ ...liked, rate: !liked.rate })} />
      <SecondaryAction icon={<PlusIcon />} label="Add to list" active={liked.list} onClick={() => onChange({ ...liked, list: !liked.list })} />
      <SecondaryAction icon={<EyeIcon />} label="Watched" active={liked.watched} onClick={() => onChange({ ...liked, watched: !liked.watched })} />
      <SecondaryAction icon={<HeartIcon filled={liked.fav} />} label="Favorite" active={liked.fav} onClick={() => onChange({ ...liked, fav: !liked.fav })} />
      <SecondaryAction icon={<ShareIcon />} label="Share" />
    </div>
  )
}
