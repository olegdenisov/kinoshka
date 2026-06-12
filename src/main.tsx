import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/styles/global.css'
import { AppRouterProvider, StoreProvider } from '@app/providers'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <AppRouterProvider />
    </StoreProvider>
  </StrictMode>,
)
