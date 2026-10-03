import type { PersonDetail } from '@entities/person'
import type { RouteLoader } from '@reatom/core'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { ApiError } from '@shared/api'
import { AsyncContent, ErrorState } from '@shared/ui'

import { Person } from './ui/Person'
import { PersonDetailSkeleton } from './ui/PersonDetailSkeleton'

const NOT_FOUND_TITLE = 'Person not found'
const NOT_FOUND_DESCRIPTION = "This person doesn't exist or was removed."

type PersonPageProps = {
  loader: RouteLoader<{ id: string }, PersonDetail>
}

export const PersonPage = reatomComponent(({ loader }: PersonPageProps) => {
  const person = loader.data()
  const error = loader.error()
  // loader.data() не очищается при смене :id — см. MoviePage.
  const pending = !loader.ready() || (!person && !error)

  return (
    <AsyncContent
      pending={pending}
      error={error}
      onRetry={wrap(loader.retry)}
      fallback={<PersonDetailSkeleton />}
      errorFallback={({ error: err, retry }) => {
        const isNotFound = err instanceof ApiError && err.status === 404

        return (
          <ErrorState
            title={isNotFound ? NOT_FOUND_TITLE : 'Something went wrong'}
            description={
              isNotFound
                ? NOT_FOUND_DESCRIPTION
                : err.message || 'Please try again later'
            }
            onRetry={retry}
          />
        )
      }}
    >
      {person && (
        // key сбрасывает локальное состояние Person (развёрнутые группы фильмографии) при
        // переходе между разными персонами.
        <Person key={person.id} person={person} />
      )}
    </AsyncContent>
  )
}, 'PersonPage')
