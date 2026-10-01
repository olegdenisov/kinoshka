---
worth: later
where: src/features/catalog-filter/lib/filtersToParams.ts:83
added: 2026-10-01
---

# фильтр Duration для сериалов, вероятно, даёт пустую выдачу

Пресет длительности всегда маппится в `movieLength`. У сериалов `movieLength` обычно пуст (длительность
серии — в `seriesLength`), поэтому `?type=series&duration=…` (и, возможно, `anime`) может вернуть пустой
каталог без подсказки. То же для `list=series-top250` вместе с `type=movie`.

**Почему отложено:** на живом API не проверено (квота 200 запросов/день), план (`docs/plans/
20261001-extended-catalog-filters.md`, Post-Completion) сознательно оставил `movieLength` и требует сначала
ручной проверки.

**Что решит вопрос:** один запрос `/v1.4/movie?type=tv-series&movieLength=90-120` на живом API. Если
`total: 0` — для сериалов маппить пресет в `seriesLength` (диапазоны пересчитать под длительность серии) либо
дизейблить Duration при `type=series`/`anime`; если выдача есть — удалить этот пункт.
