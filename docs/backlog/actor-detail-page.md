---
worth: yes
added: 2026-08-27
---

# нет страницы актёра/персоны

Клик по актёру/члену съёмочной группы (`CastTab`, `MovieMobile`'s `MobileCast`) никуда не ведёт — карточки
персон на `/movie/:id` статичны. Нужна отдельная страница персоны (по аналогии с `/movie/:id`): базовая
информация (фото, имя, дата рождения/возраст, профессия), фильмография со ссылками на карточки фильмов,
фото.

API это уже поддерживает и ничего генерировать заново не нужно: `apiClient.getV15PersonById({ path: { id } })`
(`PersonControllerFindOneV15` в `instance.gen.ts`) возвращает `Person` — `photo`, `birthday`/`age`/`growth`,
`profession[]`, `facts[]` и `movies: MovieInPerson[]` (готовая фильмография для ссылок на `/movie/:id`).

Текущий `CastMember`/`CrewMember` (`@entities/movie`) — это только `id`/`name`/`role`/`profession`/`photo`,
их достаточно для карточки в списке актёров, но недостаточно для самой страницы персоны — там нужен
отдельный fetch `getV15PersonById`, свой маппер DTO → `PersonDetail`, свой роут (`/person/:id`) и,
по паттерну проекта, пара `PersonDesktop`/`PersonMobile` в `src/pages/person/`.
