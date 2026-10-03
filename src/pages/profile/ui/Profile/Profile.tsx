import { favoriteIds } from '@features/favorites'
import {
  PROFILE_NAME_MAX_LENGTH,
  normalizeProfileName,
  profileInitials,
  profileName,
  setProfileName,
} from '@features/profile'
import { theme } from '@features/theme'
import type { Theme } from '@features/theme'
import { watchedIds } from '@features/watched'
import { watchlistIds } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { paths } from '@shared/config'
import {
  AvatarCircle,
  ChevronRightIcon,
  EyeIcon,
  ListsIcon,
  PlusIcon,
  StarIcon,
  TrendingIcon,
} from '@shared/ui'
import { useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link } from 'react-router'

import s from './Profile.module.css'

const GUEST_NAME = 'Guest'

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export const Profile = reatomComponent(() => {
  const name = profileName()
  const initials = profileInitials()
  const [draft, setDraft] = useState(name)
  const [prevName, setPrevName] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  // Успешный Save дизейблит кнопку (isDirty → false), а успешный Clear размонтирует свою — в обоих
  // случаях браузер теряет фокус, и он падает на <body>: клавиатурный/мышиный пользователь теряет
  // место на странице. Возвращаем фокус на инпут, кроме устройств, где основной указатель грубый
  // (тачскрин): принудительный focus() там открыл бы виртуальную клавиатуру без действия
  // пользователя. Медиа-запрос, а не отслеживание pointerType/клавиатуры на самой кнопке: WebKit
  // не переносит фокус на <button> по клику мышью, поэтому document.activeElement по кнопке
  // ненадёжен, а ручное отслеживание взаимодействия (onPointerDown/onKeyDown + ref) было тяжелее
  // самой задачи. Если фокус уже на инпуте (Enter внутри него), focus() — no-op.
  const restoreInputFocus = () => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    inputRef.current?.focus()
  }

  // Сохранённое имя может измениться не через эту форму (другая вкладка через storage-событие,
  // очистка) — тогда черновик синхронизируем с ним, иначе Save остался бы активным и
  // одним кликом затёр бы более новое значение старым. Паттерн «adjust state during render»,
  // а не key-ремаунт формы: ремаунт сбросил бы фокус инпута после собственного сабмита.
  // Это же обновляет черновик после сабмита: setProfileName приводит значение к trim/обрезке, и это
  // единственное место, где draft синхронизируется с уже сохранённым именем — handleSubmit не
  // дублирует эту синхронизацию вручную (см. его комментарий).
  if (name !== prevName) {
    setPrevName(name)
    setDraft(name)
  }

  const quickLinks = [
    {
      to: paths.favorites(),
      label: 'Favorites',
      Icon: ListsIcon,
      count: favoriteIds().size,
    },
    {
      to: paths.watched(),
      label: 'Watched',
      Icon: EyeIcon,
      count: watchedIds().size,
    },
    {
      to: paths.watchlist(),
      label: 'Watchlist',
      Icon: PlusIcon,
      count: watchlistIds().size,
    },
    { to: paths.popular(), label: 'Popular', Icon: TrendingIcon },
    { to: paths.recommendations(), label: 'Picks', Icon: StarIcon },
  ]

  // Сравниваем нормализованный черновик (trim/обрезка/отсев невидимых символов), ровно то, что
  // запишет setName: иначе черновик из одних невидимых символов держал бы Save активной,
  // хотя сохранять нечего.
  const isDirty = normalizeProfileName(draft) !== name

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileName(draft)
    // Черновик не трогаем здесь вручную: name обновится на следующем рендере и заведёт
    // resync-ветку выше (name !== prevName), которая и синхронизирует draft.
    restoreInputFocus()
  }

  const handleClear = () => {
    profileName.set('')
    // Clear-кнопка размонтируется вместе с условием {name && ...} ниже — без явного переноса
    // фокус упал бы на <body>, и следующий Tab начинал бы с начала документа. Инпут — ближайший
    // логичный получатель, туда же перерисуется опустевший черновик (см. restoreInputFocus).
    restoreInputFocus()
  }

  return (
    <div className={s.page}>
      <main className={s.main}>
        <h1 className={s.heading}>Profile</h1>

        <section className={s.header}>
          {/* Крупный аватар — не ProfileAvatar из @features/profile: тот является ссылкой на
              /profile, а ссылка на текущую страницу бессмысленна и вредна для скринридера.
              Визуальный кружок — тот же AvatarCircle (@shared/ui), что и внутри ProfileAvatar,
              просто без ссылки-обёртки; aria-hidden и размер 'lg' — то, что здесь специфично. */}
          <AvatarCircle initials={initials} size='lg' aria-hidden='true' />
          <p className={s.name}>{name || GUEST_NAME}</p>
          <form className={s.form} onSubmit={wrap(handleSubmit)}>
            <input
              ref={inputRef}
              className={s.input}
              type='text'
              value={draft}
              maxLength={PROFILE_NAME_MAX_LENGTH}
              placeholder='Your name'
              aria-label='Display name'
              autoComplete='off'
              onChange={event => {
                setDraft(event.target.value)
              }}
            />
            <button className={s.saveBtn} type='submit' disabled={!isDirty}>
              Save
            </button>
          </form>
        </section>

        <section className={s.section} aria-labelledby='quick-access-heading'>
          <h2 className={s.sectionHeading} id='quick-access-heading'>
            Quick access
          </h2>
          <ul className={s.linkList}>
            {quickLinks.map(({ to, label, Icon, count }) => (
              <li key={to}>
                <Link className={s.linkRow} to={to}>
                  <span className={s.linkIcon} aria-hidden='true'>
                    <Icon size={18} />
                  </span>
                  <span className={s.linkLabel}>{label}</span>
                  {count !== undefined && (
                    <span className={s.linkCount}>{count}</span>
                  )}
                  <span className={s.linkChevron} aria-hidden='true'>
                    <ChevronRightIcon />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Нативные radio в fieldset — клавиатура (стрелки) и озвучивание группы скринридером
            работают из коробки, без ручной ARIA-обвязки. h2 внутри legend: сам <legend> не входит
            в outline заголовков, и скринридер, листающий по заголовкам, пропускал бы выбор темы. */}
        <fieldset className={s.appearance}>
          <legend className={s.appearanceLegend}>
            <h2 className={s.sectionHeading}>Appearance</h2>
          </legend>
          <div className={s.themeOptions}>
            {THEME_OPTIONS.map(option => (
              <label key={option.value} className={s.themeOption}>
                <input
                  className={s.themeRadio}
                  type='radio'
                  name='theme'
                  value={option.value}
                  checked={theme() === option.value}
                  onChange={wrap(() => theme.set(option.value))}
                />
                <span className={s.themeLabel}>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {name && (
          <button
            className={s.clearBtn}
            type='button'
            onClick={wrap(handleClear)}
          >
            Clear name
          </button>
        )}

        {/* Обычный текст, а не disabled-кнопка «Sign in»: мёртвый контрол — ровно та заглушка,
            которую этот профиль заменяет */}
        <p className={s.note}>
          Local profile. Data is stored only in this browser. Account sign-in
          will arrive together with the backend.
        </p>
      </main>
    </div>
  )
}, 'Profile')
