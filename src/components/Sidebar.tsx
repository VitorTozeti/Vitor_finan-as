import { NavLink } from 'react-router-dom'
import { Home, Receipt, PieChart, TrendingUp, Settings, Target, Wallet, Calculator, Landmark } from 'lucide-react'

const items = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/graficos', label: 'Gráficos', icon: PieChart },
  { to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/orcamento', label: 'Orçamento', icon: Wallet },
  { to: '/simulador', label: 'Simulador', icon: Calculator },
  { to: '/conectar', label: 'Conectar banco', icon: Landmark },
  { to: '/configuracoes', label: 'Configurações', icon: Settings }
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/5 bg-bg2 px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="h-8 w-8 rounded-lg bg-green flex items-center justify-center text-bg font-bold text-sm">G</div>
        <span className="text-lg font-semibold tracking-tight">GreenFinance</span>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-green/10 text-green' : 'text-muted hover:bg-white/5 hover:text-txt'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
