---
worth: later
where: src/widgets/header/ui/Header/Header.tsx:212
added: 2026-09-16
---

# мёртвые контролы в хедере и футере — колокольчик, «поделиться», ссылки-колонки футера

Найдено при работе над блоком профиля (`docs/plans/completed/20260916-user-profile-block.md`):
заглушки самого профиля (аватар `AV`, задизейбленный пункт `Profile`) заменены реальным `/profile`,
но рядом остались контролы того же класса — выглядят кликабельными, ничего не делают. Чинить их —
отдельная работа, не связанная с профилем (нет ни бэкенда для уведомлений, ни интеграции Web Share
API), поэтому они заведены отдельным пунктом, а не потеряны вместе с закрытым бэклог-пунктом.

- `Header.tsx:212-215` (блок `<IconButton aria-label='Notifications'>` в `Header`) — `BellIcon` и
  декоративная точка непрочитанного (`<span className={s.notificationDot} />`, стили —
  `Header.module.css:96`) без `onClick`. Точка рисуется всегда и ничего не отражает —
  источника уведомлений нет.
- `AppLayout.tsx:126-130` (`MOVIE_CHROME.rightAction`) — `<IconButton aria-label='Share'>` с
  `ShareIcon` без обработчика. Показывается справа в `MobileHeader` на `/movie/:id`.
- `Footer.tsx:28-31,38-40` (массив колонок и `<li className={s.colItem}>` в `Footer`) — колонка
  «Account» (`My lists`, `Watched`, `Ratings`, `Recommendations`) рендерится как статичные `<li>`
  с текстом (не `<a>`/`<Link>`), при этом у
  `.colItem` в `Footer.module.css:68-73` стоит `cursor: pointer` — то есть выглядят как ссылки, но
  никуда не ведут. Тот же паттерн у соседних колонок `Catalog` (`Movies`, `Series`, `Anime`,
  `Documentaries`, `New releases`) и `About` (`Manifesto`, `Changelog`, `Contact`, `Press`) — все
  колонки футера статичны. `Footer` рендерится на главной (`Home.tsx`).

Что делать: для каждого либо подключить настоящее поведение (Web Share API / `navigator.share` для
`Share`; реальные ссылки на `/favorites`, `/recommendations` и т.п. там, где страница уже есть),
либо убрать контрол, пока поведения нет. Пункты «мой список / просмотрено / рейтинг» из закрытого
пункта про профиль сюда сознательно не входят: для них нет ни источника данных, ни аффорданса на
карточке фильма — это отдельные client-only фичи, если они когда-нибудь понадобятся.
