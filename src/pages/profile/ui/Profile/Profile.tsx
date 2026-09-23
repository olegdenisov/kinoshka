import { useFavorites } from '@features/favorites'
import {
  PROFILE_NAME_MAX_LENGTH,
  normalizeProfileName,
  useProfile,
} from '@features/profile'
import { useTheme } from '@features/theme'
import type { Theme } from '@features/theme'
import {
  AvatarCircle,
  ChevronRightIcon,
  ListsIcon,
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

// Одно из двух действий отказало ('save' | 'clear') плюс счётчик попыток — вместе описывают один
// отказ формы, поэтому это один тип и одно состояние, а не два независимых useState: раньше
// action и счётчик обновлялись из четырёх разных мест по отдельности, и ничто не
// гарантировало, что они всегда меняются парой (рассинхрон тихо вернул бы баг с неозвучиваемым
// повторным отказом — см. count ниже). count — не булев флаг: используется как React `key` на
// алерте, чтобы два отказа подряд (например, два клика по Save без правки инпута между ними) всё
// равно размонтировали и заново монтировали role='alert' узел — иначе DOM-узел не менялся бы и
// скринридер озвучивал только первый отказ.
type ProfileFailure = { action: 'save' | 'clear'; count: number }

export const Profile = () => {
  const { name, initials, setName, clearName } = useProfile()
  const { ids } = useFavorites()
  const { theme, setTheme } = useTheme()
  const [draft, setDraft] = useState(name)
  const [prevName, setPrevName] = useState(name)
  const [failure, setFailure] = useState<ProfileFailure | null>(null)
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

  // Единственная точка обновления ProfileFailure: action и count меняются строго парой (см.
  // докблок типа) — вызывать напрямую setFailure с новым отказом нельзя, иначе инвариант снова
  // держался бы только на дисциплине call-site'ов.
  const reportFailure = (action: ProfileFailure['action']) => {
    setFailure(prev => ({ action, count: (prev?.count ?? 0) + 1 }))
  }

  // Сохранённое имя может измениться не через эту форму (другая вкладка через storage-событие,
  // clearName) — тогда черновик синхронизируем с ним, иначе Save остался бы активным и
  // одним кликом затёр бы более новое значение старым. Паттерн «adjust state during render»,
  // а не key-ремаунт формы: ремаунт сбросил бы фокус инпута после собственного сабмита.
  // Это же обновляет черновик после сабмита: setName приводит значение к trim/обрезке, и это
  // единственное место, где draft синхронизируется с уже сохранённым именем — handleSubmit не
  // дублирует эту синхронизацию вручную (см. его комментарий). failure сбрасываем в той же ветке:
  // имя, изменившееся извне (другая вкладка, clearName), делает прежнее сообщение об ошибке
  // (Save или Clear) неактуальным — оно относилось к прежнему, уже не действующему состоянию формы.
  if (name !== prevName) {
    setPrevName(name)
    setDraft(name)
    setFailure(null)
  }

  const quickLinks = [
    {
      to: '/favorites',
      label: 'Favorites',
      Icon: ListsIcon,
      count: ids.length,
    },
    { to: '/popular', label: 'Popular', Icon: TrendingIcon },
    { to: '/recommendations', label: 'Picks', Icon: StarIcon },
  ]

  // Сравниваем нормализованный черновик (trim/обрезка/отсев невидимых символов), ровно то, что
  // запишет setName: иначе черновик из одних невидимых символов держал бы Save активной,
  // хотя сохранять нечего.
  const isDirty = normalizeProfileName(draft) !== name

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const saved = setName(draft)
    if (saved) {
      setFailure(null)
      // Черновик не трогаем здесь вручную: setName пишет ровно normalizeProfileName(draft), а
      // name (из useProfile) обновится на следующем рендере и заведёт resync-ветку выше
      // (name !== prevName), которая и синхронизирует draft — дублировать это вторым setDraft
      // здесь не нужно.
      restoreInputFocus()
    } else {
      // При отказе хранилища черновик не трогаем — пользователь не теряет набранное.
      reportFailure('save')
    }
  }

  const handleClear = () => {
    const cleared = clearName()
    if (cleared) {
      setFailure(null)
      // Clear-кнопка размонтируется вместе с условием {name && ...} ниже — без явного переноса
      // фокус упал бы на <body>, и следующий Tab начинал бы с начала документа. Инпут — ближайший
      // логичный получатель, туда же перерисуется опустевший черновик (см. restoreInputFocus).
      restoreInputFocus()
    } else {
      reportFailure('clear')
    }
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
          <form className={s.form} onSubmit={handleSubmit}>
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
                // Правка инпута снимает только устаревший отказ Save — он про этот же инпут.
                // Отказ Clear к вводимому тексту не относится и должен остаться видимым, пока
                // пользователь не повторит Clear (или имя не изменится извне — см. resync выше).
                setFailure(prev => (prev?.action === 'save' ? null : prev))
              }}
            />
            <button className={s.saveBtn} type='submit' disabled={!isDirty}>
              Save
            </button>
          </form>
          {failure && (
            <p key={failure.count} className={s.saveError} role='alert'>
              {failure.action === 'save'
                ? "Couldn't save the name: browser storage is unavailable."
                : "Couldn't clear the name: browser storage is unavailable."}
            </p>
          )}
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
                  checked={theme === option.value}
                  onChange={() => setTheme(option.value)}
                />
                <span className={s.themeLabel}>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {name && (
          <button className={s.clearBtn} type='button' onClick={handleClear}>
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
}
