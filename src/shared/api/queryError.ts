import { ApiError } from './client'

// Ошибка в сторе RTK Query должна быть сериализуемой — экземпляр ApiError туда класть нельзя
// (Redux ругается на несериализуемые значения, а DevTools теряет поля класса). Поэтому queryFn
// превращает исключение в простой объект, сохраняя status — по нему 404-вью и getMoviesByIds
// отличают «нет такого фильма» от сбоя.
export type QueryError = { status?: number; message: string }

export const toQueryError = (error: unknown): QueryError => {
  if (error instanceof ApiError) {
    return error.status === undefined
      ? { message: error.message }
      : { status: error.status, message: error.message }
  }
  if (error instanceof Error) return { message: error.message }
  return { message: String(error) }
}
