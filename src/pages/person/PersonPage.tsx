import { usePersonDetail } from '@entities/person'
import type { QueryError } from '@shared/api'
import {
  ErrorState,
  QueryBoundary,
  type QueryBoundaryErrorParams,
} from '@shared/ui'
import { useParams } from 'react-router'

import { Person } from './ui/Person'
import { PersonDetailSkeleton } from './ui/PersonDetailSkeleton'

const NOT_FOUND_TITLE = 'Person not found'
const NOT_FOUND_DESCRIPTION = "This person doesn't exist or was removed."

type PersonDetailContentProps = {
  id: number
}

const personErrorFallback = ({ error, reset }: QueryBoundaryErrorParams) => {
  const queryError = error as QueryError | undefined
  const isNotFound = queryError?.status === 404

  return (
    <ErrorState
      title={isNotFound ? NOT_FOUND_TITLE : 'Something went wrong'}
      description={
        isNotFound
          ? NOT_FOUND_DESCRIPTION
          : queryError?.message || 'Please try again later'
      }
      onRetry={reset}
    />
  )
}

const PersonDetailContent = ({ id }: PersonDetailContentProps) => {
  const query = usePersonDetail(id)

  // key={id} сбрасывает локальное состояние Person (развёрнутые группы
  // фильмографии в Filmography) при переходе между разными персонами —
  // тот же приём, что в MovieDetailContent для сброса активного таба.
  return (
    <QueryBoundary
      query={query}
      fallback={<PersonDetailSkeleton />}
      errorFallback={personErrorFallback}
    >
      {person => <Person key={id} person={person} />}
    </QueryBoundary>
  )
}

export const PersonPage = () => {
  const { id } = useParams<{ id: string }>()
  const numericId = Number(id)

  if (!id || !Number.isInteger(numericId) || numericId <= 0) {
    return (
      <ErrorState title={NOT_FOUND_TITLE} description={NOT_FOUND_DESCRIPTION} />
    )
  }

  return <PersonDetailContent id={numericId} />
}
