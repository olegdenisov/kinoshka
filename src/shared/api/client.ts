import { ApiInstance } from "./instance.gen";

export const apiClient = new ApiInstance({
  baseURL: import.meta.env.VITE_BASE_URL,
  headers: {
    "X-API-KEY": import.meta.env.VITE_API_KEY,
  },
  parse: "json",
})

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

apiClient.instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data as {message: unknown} | undefined
    const message = typeof data?.message === 'string' ? data.message : error.message

    return Promise.reject(new ApiError(message, error.response?.status))
  }
)