import { describe, expect, it } from 'vitest'

import {
  buildRelease,
  isSentryEnabled,
  resolveBuildSourcemap,
} from './sentry.config'

describe('buildRelease', () => {
  it('собирает release-строку из версии и git SHA', () => {
    expect(buildRelease({ version: '1.2.3', gitSha: 'abc1234' })).toBe(
      'kinoshka@1.2.3+abc1234',
    )
  })

  it('подставляет fallback-SHA как есть (без спецобработки на этом уровне)', () => {
    expect(buildRelease({ version: '0.0.0', gitSha: 'unknown' })).toBe(
      'kinoshka@0.0.0+unknown',
    )
  })
})

describe('isSentryEnabled', () => {
  const fullEnv = {
    SENTRY_AUTH_TOKEN: 'token',
    SENTRY_ORG: 'org',
    SENTRY_PROJECT: 'project',
  }

  it('true только при command === "build" и всех трёх кредах', () => {
    expect(isSentryEnabled({ command: 'build', env: fullEnv })).toBe(true)
  })

  it('false при command === "serve", даже если креды заданы', () => {
    expect(isSentryEnabled({ command: 'serve', env: fullEnv })).toBe(false)
  })

  it('false при билде без одного из кредов', () => {
    expect(
      isSentryEnabled({
        command: 'build',
        env: { SENTRY_AUTH_TOKEN: 'token', SENTRY_ORG: 'org' },
      }),
    ).toBe(false)
  })

  it('false при билде без всех кредов (плейсхолдеры .env.local)', () => {
    expect(isSentryEnabled({ command: 'build', env: {} })).toBe(false)
  })

  it('false при билде с пустыми строками вместо кредов', () => {
    expect(
      isSentryEnabled({
        command: 'build',
        env: { SENTRY_AUTH_TOKEN: '', SENTRY_ORG: '', SENTRY_PROJECT: '' },
      }),
    ).toBe(false)
  })
})

describe('resolveBuildSourcemap', () => {
  it("'hidden', когда sentry включён", () => {
    expect(resolveBuildSourcemap(true)).toBe('hidden')
  })

  it('false, когда sentry выключен — .map не должен попасть в dist/', () => {
    expect(resolveBuildSourcemap(false)).toBe(false)
  })
})
