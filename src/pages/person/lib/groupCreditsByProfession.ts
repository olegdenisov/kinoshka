import type { PersonMovieCredit } from '@entities/person'

export type CreditGroupData = {
  profession: string
  label: string
  credits: PersonMovieCredit[]
}

// Предпочтительный порядок групп: сначала основные профессии, остальные —
// в порядке первого появления в ответе API.
const PREFERRED_ORDER = [
  'actor',
  'director',
  'writer',
  'producer',
  'composer',
  'operator',
]

// не публичный экспорт: используется только в getProfessionLabel ниже.
const PROFESSION_LABELS: Record<string, string> = {
  actor: 'Actor',
  director: 'Director',
  writer: 'Writer',
  producer: 'Producer',
  composer: 'Composer',
  operator: 'Cinematographer',
  editor: 'Editor',
  designer: 'Designer',
  voice_actor: 'Voice actor',
  cameo: 'Cameo',
  uncredited: 'Uncredited',
}

// Кредит без enProfession — DTO его не гарантирует; собираем такие в отдельную
// группу, а не выкидываем фильм из фильмографии.
const UNKNOWN_PROFESSION = ''
const UNKNOWN_LABEL = 'Other'

// Фолбэк на сырой enProfession, а не отбрасывание неизвестной профессии: словарь
// Kinopoisk шире нашей карты, и терять из-за этого реальные кредиты хуже, чем
// показать непереведённый лейбл — тот же принцип, что у getGenreLabel для жанров
// вне словаря в @features/catalog-filter.
const getProfessionLabel = (profession: string): string => {
  if (profession === UNKNOWN_PROFESSION) return UNKNOWN_LABEL
  return PROFESSION_LABELS[profession] ?? profession
}

export const groupCreditsByProfession = (
  credits: PersonMovieCredit[],
): CreditGroupData[] => {
  const byProfession = new Map<string, PersonMovieCredit[]>()

  // Map сохраняет порядок вставки — это и есть «порядок первого появления»;
  // внутри группы порядок API не трогаем.
  for (const credit of credits) {
    const profession = credit.profession ?? UNKNOWN_PROFESSION
    const group = byProfession.get(profession)
    if (group) {
      group.push(credit)
    } else {
      byProfession.set(profession, [credit])
    }
  }

  const preferred = PREFERRED_ORDER.filter(p => byProfession.has(p))
  const rest = [...byProfession.keys()].filter(
    p => !PREFERRED_ORDER.includes(p),
  )

  return [...preferred, ...rest].map(profession => ({
    profession,
    label: getProfessionLabel(profession),
    credits: byProfession.get(profession)!,
  }))
}
