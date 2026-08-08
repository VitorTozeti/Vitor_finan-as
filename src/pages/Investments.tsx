import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Card, EmptyState, Skeleton } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { formatCurrency } from '../utils/finance'
import { Search, TrendingUp, TrendingDown } from 'lucide-react'
import { getQuote, QuoteResult } from '../services/marketApi'

const SUGGESTIONS = ['PETR4', 'VALE3', 'ITUB4', 'BOVA11', 'MXRF11', 'WEGE3']

export default function Investments() {
  const { state } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(ticker: string) {
    if (!ticker.trim()) return
    setLoading(true)
    setError(null)
    const result = await getQuote(ticker.trim())
    setLoading(false)
    if (!result) {
      setError('Não foi possível encontrar esse ativo. Verifique o ticker e tente novamente.')
      return
    }
    navigate(`/investimentos/${result.ticker}`)
  }

  const portfolioValue = state.portfolio.length

  return (
    <div className="pb-28">
      <Header title="Investimentos" subtitle="Acompanhe ativos e sua carteira" />
      <div className="px-5 space-y-4">
        <Card>
          <p className="text-sm font-medium mb-3">Pesquisar ativo</p>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
              placeholder="Ex: PETR4, VALE3, BOVA11..."
              className="w-full rounded-xl bg-bg border border-white/10 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-muted hover:text-green hover:border-green"
              >
                {s}
              </button>
            ))}
          </div>
          {loading && (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Minha carteira</p>
            <button onClick={() => navigate('/carteira')} className="text-xs font-medium text-green">
              Ver tudo →
            </button>
          </div>
          {portfolioValue === 0 ? (
            <EmptyState
              title="Você ainda não adicionou ativos"
              description="Registre seus investimentos para acompanhar rentabilidade e distribuição."
              actionLabel="Adicionar ativo"
              onAction={() => navigate('/carteira')}
            />
          ) : (
            <p className="text-xs text-muted">
              Você possui {portfolioValue} ativo{portfolioValue > 1 ? 's' : ''} na carteira.
            </p>
          )}
        </Card>

        <Card>
          <p className="text-sm font-medium mb-1">Simulador de investimentos</p>
          <p className="text-xs text-muted mb-3">Projete o crescimento do seu patrimônio ao longo do tempo.</p>
          <button
            onClick={() => navigate('/simulador')}
            className="w-full rounded-xl bg-green/10 text-green py-2.5 text-sm font-semibold"
          >
            Abrir simulador
          </button>
        </Card>

        <p className="text-[11px] text-muted text-center px-4">
          As informações de mercado são educacionais e não constituem recomendação de investimento.
        </p>
      </div>
    </div>
  )
}

export function QuoteBadge({ quote }: { quote: QuoteResult }) {
  const positive = quote.change >= 0
  return (
    <div className="flex items-center gap-1 text-sm font-semibold">
      {positive ? <TrendingUp size={14} className="text-green" /> : <TrendingDown size={14} className="text-danger" />}
      <span className={positive ? 'text-green' : 'text-danger'}>
        {positive ? '+' : ''}
        {quote.changePercent?.toFixed(2)}%
      </span>
    </div>
  )
}

export function priceLabel(price: number) {
  return formatCurrency(price)
}
