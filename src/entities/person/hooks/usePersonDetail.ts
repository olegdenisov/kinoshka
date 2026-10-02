import { personDetailStore } from '../api/getPersonDetail'

export const usePersonDetail = (id: number) => personDetailStore.useQuery(id)
