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

export type QueryResult<T> = { data: T } | { error: QueryError }

const isQueryError = (error: unknown): error is QueryError =>
  typeof error === 'object' &&
  error !== null &&
  !(error instanceof Error) &&
  'message' in error &&
  typeof error.message === 'string'

// unwrap() вложенного endpoint бросает error из его queryFn — это уже QueryError, его отдаём как
// есть. Всё прочее (исключение вне queryFn) нормализуем через toQueryError — без слепого каста.
export const asQueryError = (error: unknown): QueryError =>
  isQueryError(error) ? error : toQueryError(error)

// Обёртка queryFn поверх apiClient: любое исключение (ApiError из интерсептора client.ts или из
// unwrapErrorDto) становится сериализуемым QueryError.
export const runQuery = async <T>(
  request: () => Promise<T>,
): Promise<QueryResult<T>> => {
  try {
    return { data: await request() }
  } catch (error) {
    return { error: toQueryError(error) }
  }
}

type ErrorDto = { statusCode: number; message: string }

// Kinopoisk отдаёт error-DTO и в теле ответа 200 — интерсептор его не видит. Бросаем ApiError со
// status из тела: runQuery превратит его в тот же QueryError, что и HTTP-ошибку (по status — 404-вью).
export const unwrapErrorDto = <T extends object>(
  data: T,
): Exclude<T, { statusCode: number }> => {
  if ('statusCode' in data) {
    const dto = data as unknown as ErrorDto
    throw new ApiError(dto.message, dto.statusCode)
  }
  return data as Exclude<T, { statusCode: number }>
}
