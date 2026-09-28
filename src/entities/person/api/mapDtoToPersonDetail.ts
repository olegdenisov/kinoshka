import type { Person } from '@shared/api'

import type { PersonDetail, PersonMovieCredit } from '../model/types'

// Kinopoisk иногда кладёт в facts[].value HTML-разметку (`<span class="...">`),
// хотя в проверенной выборке это был простой текст — вырезаем теги, чтобы не
// рендерить их пользователю сырыми (dangerouslySetInnerHTML в проекте не используется).
const stripHtmlTags = (value: string): string =>
  value.replace(/<[^>]*>/g, '').trim()

const mapMovieCredit = (
  movie: NonNullable<Person['movies']>[number],
): PersonMovieCredit | undefined => {
  const title = movie.name ?? movie.alternativeName ?? ''

  // ссылка без имени бесполезна и ломает доступное имя ссылки в Filmography — отбрасываем
  if (!title) {
    return undefined
  }

  return {
    id: movie.id,
    title,
    rating: movie.rating ?? undefined,
    role: movie.description ?? undefined,
    profession: movie.enProfession ?? undefined,
  }
}

export const mapDtoToPersonDetail = (dto: Person): PersonDetail => {
  const name = dto.name ?? dto.enName ?? ''

  return {
    id: dto.id,
    name,
    // не дублировать enName, если он совпал с уже выбранным name
    enName: dto.enName && dto.enName !== name ? dto.enName : undefined,
    photo: dto.photo ?? undefined,
    birthday: dto.birthday ?? undefined,
    death: dto.death ?? undefined,
    age: dto.age ?? undefined,
    growth: dto.growth ?? undefined,
    birthPlace:
      dto.birthPlace
        ?.map(place => place.value)
        .filter((value): value is string => !!value) ?? [],
    deathPlace:
      dto.deathPlace
        ?.map(place => place.value)
        .filter((value): value is string => !!value) ?? [],
    countAwards: dto.countAwards,
    // API возвращает повторы профессий — дедуплицируем через Set
    professions: [
      ...new Set(
        dto.profession
          ?.map(profession => profession.value)
          .filter((value): value is string => !!value) ?? [],
      ),
    ],
    facts:
      dto.facts
        ?.map(fact => fact.value)
        .filter((value): value is string => !!value)
        .map(stripHtmlTags)
        .filter(Boolean) ?? [],
    movies:
      dto.movies
        ?.map(mapMovieCredit)
        .filter((credit): credit is PersonMovieCredit => !!credit) ?? [],
  }
}
