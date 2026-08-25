---
worth: yes
where: src/entities/movie/ui/Poster/Poster.tsx:27
added: 2026-08-25
---
# постеры фильмов грузятся без lazy loading

`Poster` (`@entities/movie/ui/Poster`) рендерит `<img src={movie.poster} alt='' className={s.img} />`
без атрибута `loading='lazy'`. Компонент используется в карточках (`Card`/`MobileCard`) на домашней
ленте, в поиске и в списке избранного — везде, где рельсы/сетки карточек уходят далеко за пределы
первого экрана, все постеры запрашиваются сразу при монтировании страницы вместо подгрузки по мере
скролла. Фикс механический — добавить `loading='lazy'` на `<img>` в `Poster.tsx`.
