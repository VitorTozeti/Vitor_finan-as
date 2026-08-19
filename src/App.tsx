import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { StoreProvider, useStore } from './store/useStore'
import { applyTheme } from './data/themes'
import BottomNavigation from './components/BottomNavigation'
import Sidebar from './components/Sidebar'
import { ToastHost } from './components/Primitives'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Charts from './pages/Charts'
import Investments from './pages/Investments'
import AssetAnalysis from './pages/AssetAnalysis'
import Portfolio from './pages/Portfolio'
import Budget from './pages/Budget'
import Goals from './pages/Goals'
import Simulator from './pages/Simulator'
import ConnectBank from './pages/ConnectBank'
import Settings from './pages/Settings'
import More from './pages/More'
import Benefits from './pages/Benefits'
import Onboarding from './pages/Onboarding'

function AppShell() {
  const { state } = useStore()

  // Keep the document theme in sync with the user's setting.
  useEffect(() => {
    applyTheme(state.settings.theme)
  }, [state.settings.theme])

  if (!state.settings.onboarded) {
    return <Onboarding />
  }

  return (
    <div className="min-h-screen bg-bg text-txt flex">
      <Sidebar />
      <div className="flex-1 min-w-0 md:max-w-3xl md:mx-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/gastos" element={<Expenses />} />
          <Route path="/graficos" element={<Charts />} />
          <Route path="/investimentos" element={<Investments />} />
          <Route path="/investimentos/:ticker" element={<AssetAnalysis />} />
          <Route path="/carteira" element={<Portfolio />} />
          <Route path="/beneficios" element={<Benefits />} />
          <Route path="/metas" element={<Goals />} />
          <Route path="/orcamento" element={<Budget />} />
          <Route path="/simulador" element={<Simulator />} />
          <Route path="/conectar" element={<ConnectBank />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/mais" element={<More />} />
        </Routes>
      </div>
      <BottomNavigation />
      <ToastHost />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <HashRouter>
          <AppShell />
        </HashRouter>
      </StoreProvider>
    </ErrorBoundary>
  )
}
