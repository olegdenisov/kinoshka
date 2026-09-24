---
worth: maybe
where: src/pages/home/ui/HeroSection/HeroSection.module.css:21
added: 2026-09-24
---

# фоновый градиент hero на главной не тонируется темой

`.backgroundGradient` в `HeroSection.module.css` — три `radial-gradient` с захардкоженными
`oklch(...)`, в том числе почти чёрное пятно `oklch(0.12 0.02 20)` внизу. Под ним нет фото
(в отличие от скримов `Poster`/`MovieHero`), это декоративный фон поверх `--bg-primary`, поэтому
в светлой теме он, скорее всего, выглядит как тёмная клякса. Аудит захардкоженных цветов при
внедрении темы (`docs/plans/completed/20260819-theme-toggle.md`, Task 8) его пропустил.

Нашёл stylelint (`function-disallowed-list`), когда его подключили. Сейчас строки подавлены
`stylelint-disable` со ссылкой сюда. Что сделать: открыть `/` в светлой теме, решить визуально,
завести токены `--hero-glow-*` в обоих блоках `global.css` и убрать disable.
