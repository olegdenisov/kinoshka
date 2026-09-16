import { describe, expect, it } from 'vitest'

import { validateEnv } from './provision-sentry-telemetry.ts'

// main() сознательно НЕ импортируется/не вызывается здесь — он бы реально дёргал `sentry` CLI
// (execFileSync) при каждом `make test` (см. WHY-комментарий в provision-sentry-telemetry.ts,
// import.meta.url-guard в конце файла). Юнит-тестами покрыта только чистая env-валидация, как и
// оговорено в Testing Strategy плана: "не сам факт создания объекта в реальном Sentry".

describe('validateEnv', () => {
  it('возвращает { org, project }, когда оба заданы', () => {
    expect(
      validateEnv({ SENTRY_ORG: 'mycomp-ey', SENTRY_PROJECT: 'kinoshka' }),
    ).toEqual({ org: 'mycomp-ey', project: 'kinoshka' })
  })

  it('бросает понятную ошибку, если SENTRY_ORG не задан', () => {
    expect(() => validateEnv({ SENTRY_PROJECT: 'kinoshka' })).toThrow(
      /SENTRY_ORG\/SENTRY_PROJECT не заданы/,
    )
  })

  it('бросает понятную ошибку, если SENTRY_PROJECT не задан', () => {
    expect(() => validateEnv({ SENTRY_ORG: 'mycomp-ey' })).toThrow(
      /SENTRY_ORG\/SENTRY_PROJECT не заданы/,
    )
  })

  it('бросает понятную ошибку, если оба не заданы (edge case — пустой env)', () => {
    expect(() => validateEnv({})).toThrow(
      /SENTRY_ORG\/SENTRY_PROJECT не заданы/,
    )
  })
})
