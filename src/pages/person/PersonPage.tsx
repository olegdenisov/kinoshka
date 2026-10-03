import { invalidatePersonDetail, usePersonDetail } from '@entities/person'
import { ApiError } from '@shared/api'
import { AsyncBoundary, ErrorState, type ErrorFallbackParams } from '@shared/ui'

import { Person } from './ui/Person'
import { PersonDetailSkeleton } from './ui/PersonDetailSkeleton'

const NOT_FOUND_TITLE = 'Person not found'
const NOT_FOUND_DESCRIPTION = "This person doesn't exist or was removed."

type PersonDetailContentProps = {
  id: number
}

const PersonDetailContent = ({ id }: PersonDetailContentProps) => {
  const person = usePersonDetail(id)

  // key={id} сбрасывает локальное состояние Person (развёрнутые группы
  // фильмографии в Filmography) при переходе между разными персонами —
  // тот же приём, что в MovieDetailContent для сброса активного таба.
  return <Person key={id} person={person} />
}

const personErrorFallback = ({ error, reset }: ErrorFallbackParams) => {
  const isNotFound = error instanceof ApiError && error.status === 404

  return (
    <ErrorState
      title={isNotFound ? NOT_FOUND_TITLE : 'Something went wrong'}
      description={
        isNotFound
          ? NOT_FOUND_DESCRIPTION
          : error?.message || 'Please try again later'
      }
      onRetry={reset}
    />
  )
}

type PersonPageProps = {
  /** Сырой сегмент пути из роута (`/person/:id`); валидирует страница. */
  id: string
}

export const PersonPage = ({ id }: PersonPageProps) => {
  const numericId = Number(id)

  if (!id || !Number.isInteger(numericId) || numericId <= 0) {
    return (
      <ErrorState title={NOT_FOUND_TITLE} description={NOT_FOUND_DESCRIPTION} />
    )
  }

  return (
    <AsyncBoundary
      errorFallback={personErrorFallback}
      fallback={<PersonDetailSkeleton />}
      onRetry={() => invalidatePersonDetail(numericId)}
    >
      <PersonDetailContent id={numericId} />
    </AsyncBoundary>
  )
}
