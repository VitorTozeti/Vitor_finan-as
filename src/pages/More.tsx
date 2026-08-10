import { Link } from 'react-router-dom'
import Header from '../components/Header'
import { Card } from '../components/Primitives'
import { Target, Wallet, Calculator, Settings, Briefcase, Landmark, ChevronRight } from 'lucide-react'

const items = [
  { to: '/metas', label: 'Metas financeiras', icon: Target, desc: 'Acompanhe seus objetivos' },
  { to: '/orcamento', label: 'Orçamento', icon: Wallet, desc: 'Defina limites por categoria' },
  { to: '/carteira', label: 'Carteira de investimentos', icon: Briefcase, desc: 'Seus ativos e rentabilidade' },
  { to: '/simulador', label: 'Simulador', icon: Calculator, desc: 'Projete seu patrimônio' },
  { to: '/conectar', label: 'Conectar banco', icon: Landmark, desc: 'Importe extratos OFX/CSV' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, desc: 'Renda, dados e privacidade' }
]

export default function More() {
  return (
    <div className="pb-28 md:hidden">
      <Header title="Mais" subtitle="Todas as ferramentas do GreenFinance" />
      <div className="px-5 space-y-2">
        {items.map(({ to, label, icon: Icon, desc }) => (
          <Link key={to} to={to}>
            <Card className="!p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green/10 flex items-center justify-center text-green">
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted">{desc}</p>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
