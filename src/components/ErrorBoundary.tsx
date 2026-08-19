import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

/** Catches render errors anywhere below it so a bad state (e.g. from a
 * migration edge case) shows a recoverable screen instead of a blank page. */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('GreenFinance crashed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg text-txt px-6">
          <div className="max-w-sm text-center">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-line/5 flex items-center justify-center mb-4 text-2xl">
              ⚠️
            </div>
            <p className="font-semibold mb-1">Algo deu errado</p>
            <p className="text-sm text-muted mb-5">
              O GreenFinance encontrou um erro inesperado. Seus dados salvos não foram apagados — tente recarregar a
              página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-green px-5 py-2.5 text-sm font-semibold text-bg"
            >
              Recarregar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
