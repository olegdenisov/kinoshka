import { apiClient, ApiError, type MovieControllerFindOneV15Data } from "@shared/api";
import type { MovieDetail } from "../model/types";
import { createCachedFetcher } from "./createCachedFetcher";
import { mapDtoToMovieDetail } from "./mapDtoToMovieDetail";

type Id = NonNullable<NonNullable<MovieControllerFindOneV15Data['path']>['id']>;

const fetchMovieDetail = async (params: {id: Id}): Promise<MovieDetail> => {
  const response = await apiClient.getV15MovieById(
    {
      path: {
        id: params.id,
      },
  })

  if ('statusCode' in response.data) { // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode);
  }

  return mapDtoToMovieDetail(response.data);
}

export const getMovieDetail = createCachedFetcher('movie-detail', fetchMovieDetail)
