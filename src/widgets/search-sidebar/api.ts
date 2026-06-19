import { instance, type PossibleValueDto } from "@shared/api"
import { baseApi } from "@shared/api/baseApi"

type FilterFieldName = 'genres.name' | 'type' 

export const searchApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getGenres: builder.query<PossibleValueDto[], FilterFieldName>({
      async queryFn(field: FilterFieldName) {
        try {
          const response =
            await instance.getV1MoviePossibleValuesByField({
              query: {
                field,
              }
            })

          const genres = response.data

          return {data: genres ?? []}
        } catch (error) {
          return {
            error,
          }
        }
      },

      providesTags: ['Genres'],
    }),
  }),
})

export const {
  useGetGenresQuery,
} = searchApi