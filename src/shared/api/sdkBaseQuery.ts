import type { BaseQueryFn } from '@reduxjs/toolkit/query'

export const sdkBaseQuery: BaseQueryFn<
  {
    fn: () => Promise<unknown>
  },
  unknown,
  unknown
> = async ({ fn }) => {
  try {
    const result = await fn()

    return {
      data: result,
    }
  } catch (error) {
    return {
      error,
    }
  }
}