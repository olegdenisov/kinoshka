import { baseApi } from '@shared/api'
import { trackEvent } from '@shared/lib'

import { favoritesToggled } from './favoritesSlice'
import { favoritesSlot } from './favoritesStorage'

type ToggleFavoriteResult = { added: boolean }

// Учебная конструкция для roadmap 3.1: localStorage играет роль «сервера», запись в него — mutation.
// Без сервера хватило бы slice с listener-persist, как у watched/watchlist.
export const favoritesApi = baseApi.injectEndpoints({
  endpoints: build => ({
    toggleFavorite: build.mutation<ToggleFavoriteResult, number>({
      // Следующее значение считается от слота («сервера»), а не от стейта: в стейте уже лежит
      // оптимистичное изменение из onQueryStarted.
      queryFn: id => {
        const current = favoritesSlot.get()
        const added = !current.includes(id)
        const next = added
          ? [...current, id]
          : current.filter(existingId => existingId !== id)

        // set() не бросает при недоступном хранилище, а возвращает false (см. createStorageSlot).
        if (!favoritesSlot.set(next)) {
          return { error: { message: 'Failed to save favorites' } }
        }
        return { data: { added } }
      },
      // Только при успехе: при ошибке перезапрос рекомендаций гонится с откатом в onQueryStarted и
      // может прочитать ещё не откатанные id.
      invalidatesTags: (_result, error) => (error ? [] : ['Recommendations']),
      // onQueryStarted вызывается синхронно на pending-экшене, до queryFn: к моменту записи слота стейт
      // уже совпадает с ним, и subscribeSlot не диспатчит лишний hydrated.
      onQueryStarted: async (id, { dispatch, queryFulfilled }) => {
        dispatch(favoritesToggled(id))
        try {
          const { data } = await queryFulfilled
          // trackEvent только после успешной записи — иначе Plausible считал бы "favorite added" в
          // сессиях, где избранное на самом деле не сохранилось.
          if (data.added) trackEvent('favorite added')
        } catch {
          // Повторный toggled возвращает id в исходное положение.
          dispatch(favoritesToggled(id))
        }
      },
    }),
  }),
})

export const { useToggleFavoriteMutation } = favoritesApi
