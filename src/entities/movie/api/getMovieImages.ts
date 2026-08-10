import { apiClient } from "@shared/api"
import { createCachedFetcher } from "./createCachedFetcher"

export type MovieImage = {
  url: string
  previewUrl?: string
}

const fetchMovieImages = async (id: number): Promise<MovieImage[]> => {
  const response = await apiClient.getV15Image({
    query: {
      movieId: [String(id)],
      type: ["frame", "screenshot"],
      limit: 8,
      selectFields: ["url", "previewUrl"],
    },
  })

  if (!("docs" in response.data)) {
    // нужно чтобы сузить тип
    return []
  }

  return response.data.docs
    .filter((image): image is typeof image & { url: string } => !!image.url)
    .map((image) => ({
      url: image.url,
      previewUrl: image.previewUrl ?? undefined,
    }))
}

export const getMovieImages = createCachedFetcher<number, MovieImage[]>(
  "movie-images",
  fetchMovieImages,
)
