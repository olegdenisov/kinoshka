// Переключает предзагруженный (media="print", не блокирует первый рендер)
// Google Fonts stylesheet на media="all" после его реальной загрузки — см.
// index.html и AGENTS.md/Lighthouse CI, Task 3 (render-blocking-resources).
// Не инлайн-скрипт специально: script-src в vercel.json's CSP разрешает
// 'self' и не требует пересчёта sha256-хэша для same-origin <script src>.
;(function () {
  var link = document.getElementById('gfonts-stylesheet')
  if (!link) return
  if (link.sheet) {
    link.media = 'all'
    return
  }
  link.addEventListener('load', function () {
    link.media = 'all'
  })
})()
