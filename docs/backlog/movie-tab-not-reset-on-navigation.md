---
worth: yes
added: 2026-08-25
---
# таб на странице фильма не сбрасывается на Overview при смене фильма

`MovieDesktop` (`src/pages/movie/ui/MovieDesktop/MovieDesktop.tsx:26`) и `MovieMobile`
(`src/pages/movie/ui/MovieMobile/MovieMobile.tsx:83`) держат активный таб в локальном
`useState('Overview')`. Роут `/movie/:id` не меняет тип компонента при переходе между
разными `id` (например, по ссылке из похожих фильмов), React Router переиспользует тот же
инстанс, а `key={id}` нигде не проставлен и `useEffect`, сбрасывающего `tab` при смене `id`,
тоже нет. В результате, если открыть фильм A, переключиться на вкладку Cast/Media и перейти
на фильм B, у фильма B по умолчанию будет активна та же вкладка вместо Overview.

Фикс механический: сбросить `tab` в `'Overview'` при смене `id` (либо через `useEffect`,
либо через `key={id}` на `MovieDesktop`/`MovieMobile` в `MoviePage.tsx`) — в обоих файлах
одинаково.
