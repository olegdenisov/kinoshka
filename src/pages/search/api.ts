import { mapMovieDTO } from "@entities/movie/lib/mapMovieDTO"
import { instance } from "@shared/api"
import { baseApi } from "@shared/api/baseApi"
import type { FilterState } from "@features/catalog-filter"

export const searchApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getMovies: builder.query({
      async queryFn(filters: FilterState) {
        try {
          const response =
            await instance.getV15Movie({
              query: {
                selectFields: ['id', 'name', 'shortDescription', 'year', 'rating', 'genres', 'poster'],
                notNullFields: ['poster.url', 'rating.kp'],
                ...(filters.genres ? {"genres.name": filters.genres} :{}),
                ...(filters.type ? {type: [filters.type]} :{}),
                ...(filters.rating ? {"rating.kp": [`${filters.rating}-10`]} :{}),
                limit: 16
              }
            })

          const data = response.data

          if (!('docs' in data)) {
            throw {error: data}
          }

          const movies = data.docs.map(mapMovieDTO)

          return {
            data: {
              ...data,
              movies,
            },
          }
        } catch (error) {
          return {
            error,
          }
        }
      },

      providesTags: ['Movies'],
    }),
  }),
})

export const {
  useGetMoviesQuery,
} = searchApi