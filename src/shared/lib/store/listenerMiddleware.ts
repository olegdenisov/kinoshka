import type { TypedStartListening } from '@reduxjs/toolkit'

// Дженерик по форме стейта: shared не знает RootState, фича передаёт форму своего среза.
export type StartListening<State> = TypedStartListening<State>
