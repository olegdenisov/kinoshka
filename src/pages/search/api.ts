import { mapMovieDTO } from "@entities/movie/lib/mapMovieDTO"
import { instance } from "@shared/api"
import { baseApi } from "@shared/api/baseApi"

export const searchApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getMovies: builder.query({
      async queryFn(search: string) {
        try {
          const response =
            await instance.getV15Movie({
              query: {
                selectFields: ['id', 'name', 'shortDescription', 'year', 'rating', 'genres', 'poster'],
                notNullFields: ['poster.url', 'rating.kp'],
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