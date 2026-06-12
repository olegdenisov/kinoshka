import { RouterProvider } from 'react-router'
import { router } from './router'

export const AppRouterProvider = () => {
  return <RouterProvider router={router} />
}
