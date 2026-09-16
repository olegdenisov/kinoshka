vi.mock('./sentry', () => ({ initSentry: vi.fn() }))

describe('sentry-bootstrap', () => {
  it('вызывает initSentry ровно один раз при импорте модуля', async () => {
    const { initSentry } = await import('./sentry')

    await import('./sentry-bootstrap')

    expect(initSentry).toHaveBeenCalledTimes(1)
  })
})
