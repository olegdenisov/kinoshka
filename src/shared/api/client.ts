import { ApiInstance } from "./instance.gen";

export const apiClient = new ApiInstance({
  baseURL: import.meta.env.VITE_BASE_URL,
  headers: {
    "X-API-KEY": import.meta.env.VITE_API_KEY,
  },
  parse: "json",
})