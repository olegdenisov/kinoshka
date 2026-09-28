export const formatDate = (
  isoDate: string,
  locale: string = navigator.language,
): string => {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) return isoDate

  // Kinopoisk отдаёт календарные даты (день рождения/смерти, премьера) как
  // UTC-полночь ("1964-09-02T00:00:00.000Z"), а не момент времени. Без
  // timeZone: 'UTC' Intl форматирует их в локальной зоне зрителя, и к западу
  // от UTC дата сдвигается на день назад.
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date)
}
