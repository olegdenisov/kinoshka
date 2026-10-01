import { ApiError } from './client'
import { toQueryError } from './queryError'

describe('toQueryError', () => {
  it('ApiError со статусом → { status, message }', () => {
    expect(toQueryError(new ApiError('Not found', 404))).toEqual({
      status: 404,
      message: 'Not found',
    })
  })

  it('ApiError без статуса (сетевой сбой) → только message', () => {
    expect(toQueryError(new ApiError('Network Error'))).toEqual({
      message: 'Network Error',
    })
  })

  it('обычный Error → { message } без status', () => {
    expect(toQueryError(new Error('boom'))).toEqual({ message: 'boom' })
  })

  it('не-Error значение → строковое message', () => {
    expect(toQueryError('oops')).toEqual({ message: 'oops' })
    expect(toQueryError(undefined)).toEqual({ message: 'undefined' })
  })

  it('результат сериализуем — переживает JSON-раунд-трип без потерь', () => {
    const error = toQueryError(new ApiError('Forbidden', 403))
    expect(JSON.parse(JSON.stringify(error))).toEqual(error)
  })
})
