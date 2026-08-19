import { NavLink } from 'react-router-dom'
import { Home, Receipt, PieChart, TrendingUp, MoreHorizontal } from 'lucide-react'

const items = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/graficos', label: 'Gráficos', icon: PieChart },
  { to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { to: '/mais', label: 'Mais', icon: MoreHorizontal }
]

export default function BottomNavigation() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-line/5 bg-bg2/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navegação principal"
    >
      <ul className="flex items-stretch justify-between px-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-green' : 'text-muted'
                }`
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
