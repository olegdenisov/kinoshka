import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'

import type { QueryError } from './queryError'

// Пустой createApi: endpoints инжектят entities, features и pages через injectEndpoints — общая
// точка для всех слоёв может жить только в shared. fakeBaseQuery вместо fetchBaseQuery: каждый
// endpoint — queryFn поверх сгенерированного apiClient, у которого уже есть интерсептор и типы.
// keepUnusedDataFor: 300 — тот же TTL, что был у прежнего кеша фетчеров (5 минут).
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<QueryError>(),
  tagTypes: ['Recommendations'],
  keepUnusedDataFor: 300,
  endpoints: () => ({}),
})
