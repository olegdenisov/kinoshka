export const formatDate = (
  isoDate: string,
  locale: string = navigator.language,
): string => {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) return isoDate

  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)
}
