import { createApi } from '@reduxjs/toolkit/query/react'

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: async () => ({ data: null }),
  tagTypes: [
    'Movie',
    'Movies',
    'Anime',
  ],
  endpoints: () => ({}),
})