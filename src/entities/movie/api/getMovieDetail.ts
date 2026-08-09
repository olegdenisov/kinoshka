import { apiClient, ApiError } from "@shared/api";
import type { MovieDetail } from "../model/types";
import { createCachedFetcher } from "./createCachedFetcher";
import { mapDtoToMovieDetail } from "./mapDtoToMovieDetail";

const fetchMovieDetail = async (id: number): Promise<MovieDetail> => {
  const response = await apiClient.getV15MovieById({ path: { id } })

  if ('statusCode' in response.data) { // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode)
  }

  return mapDtoToMovieDetail(response.data)
}

export const getMovieDetail = createCachedFetcher<number, MovieDetail>('movie-detail', fetchMovieDetail)
