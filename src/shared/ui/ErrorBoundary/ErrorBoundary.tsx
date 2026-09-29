import { Component, type ErrorInfo, type ReactNode } from 'react'

export type ErrorBoundaryFallbackParams = {
  error: Error | null
  reset: () => void
}

type Props = {
  children: ReactNode
  fallback: (params: ErrorBoundaryFallbackParams) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.reset,
      })
    }

    return this.props.children
  }
}
