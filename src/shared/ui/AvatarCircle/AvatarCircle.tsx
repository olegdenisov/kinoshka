import type { ComponentPropsWithoutRef } from 'react'

import { ProfileIcon } from '../Icon'

import s from './AvatarCircle.module.css'

type AvatarCircleSize = 'sm' | 'lg'

type AvatarCircleProps = {
  initials: string
  size: AvatarCircleSize
} & ComponentPropsWithoutRef<'div'>

// Иконка-заглушка чуть меньше самого кружка в обоих размерах — те же пропорции, что раньше
// подбирались отдельно в ProfileAvatar (без size, дефолт ProfileIcon 20px в 32px кружке) и в
// Profile.tsx (28px в 72px кружке).
const ICON_SIZE: Record<AvatarCircleSize, number> = { sm: 20, lg: 28 }

// Общая визуальная реализация кружка аватара — раньше дублировалась в ProfileAvatar.module.css
// (32px, ссылка на /profile) и в Profile.module.css (72px, декоративный кружок на самой /profile):
// одинаковый градиент/бордер/шрифт/цвет с почти идентичным CSS, различавшимся только размером.
// Семантику (ссылка vs decorative div, aria-label vs aria-hidden) оставляем на совести вызывающих —
// этот компонент только рисует кружок с инициалами или иконкой-заглушкой.
export const AvatarCircle = ({
  initials,
  size,
  className,
  ...rest
}: AvatarCircleProps) => (
  <div className={`${s.avatar} ${s[size]} ${className ?? ''}`} {...rest}>
    {initials || <ProfileIcon size={ICON_SIZE[size]} />}
  </div>
)
