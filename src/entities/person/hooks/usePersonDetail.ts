import { useGetPersonDetailQuery } from '../api/personApi'

export const usePersonDetail = (id: number) => useGetPersonDetailQuery(id)
