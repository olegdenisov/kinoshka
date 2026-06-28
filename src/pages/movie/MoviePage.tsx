import { useParams } from 'react-router'
import { useViewport } from '../../shared/lib/viewport/useViewport'
import { CATALOG } from '@entities/movie'
import { MovieDesktop } from './ui/MovieDesktop'
import { MovieMobile } from './ui/MovieMobile'

export const MoviePage = () => {
  const { id } = useParams<{ id: string }>()
  const { isMobile } = useViewport()
  const movie = CATALOG.find((m) => m.id === Number(id)) ?? CATALOG[0]

  return isMobile ? <MovieMobile movie={movie} /> : <MovieDesktop movie={movie} />
}
