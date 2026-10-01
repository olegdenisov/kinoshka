import { createListenerMiddleware } from '@reduxjs/toolkit'
import type { TypedStartListening } from '@reduxjs/toolkit'

export type ListenerMiddlewareInstance = ReturnType<
  typeof createListenerMiddleware
>

// Фабрика, а не модульный синглтон: каждый makeStore() (а в тестах — каждый тест) получает свой
// экземпляр, иначе listener'ы, зарегистрированные для одного стора, срабатывали бы и для другого.
export const createAppListenerMiddleware = (): ListenerMiddlewareInstance =>
  createListenerMiddleware()

// Дженерик по форме стейта: shared не знает RootState, фича передаёт форму своего среза.
export type StartListening<State> = TypedStartListening<State>
