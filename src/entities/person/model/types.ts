// Один кредит фильмографии. Намеренно НЕ `Movie`: `MovieInPerson` не отдаёт
// poster/type/genre/year, поэтому приведение к `Movie` потребовало бы выдуманных
// дефолтов (см. «Обзор решения», отклонённый вариант A в плане /person/:id).
export type PersonMovieCredit = {
  id: number
  title: string
  rating?: number
  // `description` в DTO — имя персонажа для актёров; для остальных профессий обычно пусто.
  role?: string
  // сырой `enProfession` (actor/producer/director/...); маппинг в человекочитаемую
  // подпись делает page-слой, чтобы entity не занимался презентацией.
  profession?: string
}

export type PersonDetail = {
  id: number
  name: string
  enName?: string
  photo?: string
  // ISO-строки как есть — форматирование локалью живёт в page-слое (formatDate).
  birthday?: string
  death?: string
  age?: number
  growth?: number
  birthPlace: string[]
  deathPlace: string[]
  countAwards?: number
  professions: string[]
  // Теги уже вырезаны в мапере (см. mapDtoToPersonDetail) — компонент рендерит как есть.
  facts: string[]
  movies: PersonMovieCredit[]
}
