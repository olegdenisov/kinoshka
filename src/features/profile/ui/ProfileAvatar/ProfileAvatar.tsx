import { PROFILE_ARIA_LABEL_PREFIX } from '@shared/lib'
import { AvatarCircle } from '@shared/ui'
import { NavLink } from 'react-router'

import { useProfile } from '../../model/useProfile'

import s from './ProfileAvatar.module.css'

// aria-label включает имя: иначе скринридер прочитал бы только пару букв инициалов.
// NavLink, а не Link: на самой /profile он сам выставляет aria-current='page'.
// data-sentry-component: Sentry в ui.click-крошке безусловно сериализует aria-label — то есть
// введённое имя ушло бы в сторонний сервис. Для элемента с этим атрибутом сериализатор
// возвращает только его значение и aria-label не читает (вторая линия защиты — beforeBreadcrumb,
// scrubProfileNameBreadcrumb в src/app/sentry.ts). PROFILE_ARIA_LABEL_PREFIX — общая константа с
// sentry.ts (@shared/lib), а не два независимых литерала: см. её докблок. Визуальный кружок —
// AvatarCircle (@shared/ui), общий с декоративным аватаром на самой /profile (Profile.tsx);
// здесь он только внутри ссылки — фокус/text-decoration остаются на NavLink (см. .link ниже).
export const ProfileAvatar = () => {
  const { name, initials } = useProfile()

  return (
    <NavLink
      to='/profile'
      className={s.link}
      data-sentry-component='ProfileAvatar'
      aria-label={name ? `${PROFILE_ARIA_LABEL_PREFIX}${name}` : 'Your profile'}
    >
      <AvatarCircle initials={initials} size='sm' />
    </NavLink>
  )
}
