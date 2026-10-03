import { urlAtom } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { paths } from '@shared/config'
import { PROFILE_ARIA_LABEL_PREFIX } from '@shared/lib'
import { AvatarCircle } from '@shared/ui'

import { profileInitials, profileName } from '../../model/profile'

import s from './ProfileAvatar.module.css'

// aria-label включает имя: иначе скринридер прочитал бы только пару букв инициалов.
// aria-current='page' на самой /profile — то, что раньше делал NavLink.
// data-sentry-component: Sentry в ui.click-крошке безусловно сериализует aria-label — то есть
// введённое имя ушло бы в сторонний сервис. Для элемента с этим атрибутом сериализатор
// возвращает только его значение и aria-label не читает (вторая линия защиты — beforeBreadcrumb,
// scrubProfileNameBreadcrumb в src/app/sentry.ts). PROFILE_ARIA_LABEL_PREFIX — общая константа с
// sentry.ts (@shared/lib), а не два независимых литерала: см. её докблок. Визуальный кружок —
// AvatarCircle (@shared/ui), общий с декоративным аватаром на самой /profile (Profile.tsx);
// здесь он только внутри ссылки — фокус/text-decoration остаются на ссылке (см. .link ниже).
export const ProfileAvatar = reatomComponent(() => {
  const name = profileName()
  const initials = profileInitials()

  return (
    <a
      href={paths.profile()}
      className={s.link}
      aria-current={urlAtom().pathname === paths.profile() ? 'page' : undefined}
      data-sentry-component='ProfileAvatar'
      aria-label={name ? `${PROFILE_ARIA_LABEL_PREFIX}${name}` : 'Your profile'}
    >
      <AvatarCircle initials={initials} size='sm' />
    </a>
  )
}, 'ProfileAvatar')
