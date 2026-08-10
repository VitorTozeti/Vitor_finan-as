import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Card, EmptyState, Skeleton } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { formatCurrency, formatSignedPct } from '../utils/finance'
import { Search, TrendingUp, TrendingDown, ChevronRight, RefreshCw } from 'lucide-react'
import { getQuote, getQuotesBatch, QuoteResult } from '../services/marketApi'
import { WATCHLIST } from '../data/investing'

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

        <RecommendedAssets onOpen={t => navigate(`/investimentos/${t}`)} />

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

function RecommendedAssets({ onOpen }: { onOpen: (ticker: string) => void }) {
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  async function load() {
    setStatus('loading')
    const results = await getQuotesBatch(WATCHLIST.map(w => w.ticker))
    if (results.length === 0) {
      setStatus('error')
      return
    }
    const map: Record<string, QuoteResult> = {}
    for (const r of results) map[r.ticker] = r
    setQuotes(map)
    setStatus('ready')
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Order the curated list by today's performance (biggest movers first).
  const ordered = [...WATCHLIST].sort((a, b) => {
    const ca = quotes[a.ticker]?.changePercent ?? -Infinity
    const cb = quotes[b.ticker]?.changePercent ?? -Infinity
    return cb - ca
  })

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium">Destaques do mercado</p>
        <button
          onClick={load}
          aria-label="Atualizar cotações"
          className="text-muted hover:text-green"
        >
          <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-xs text-muted mb-3">Ativos populares para começar, ordenados pela variação do dia.</p>

      {status === 'error' && (
        <p className="text-xs text-muted">Não foi possível carregar as cotações agora. Tente novamente mais tarde.</p>
      )}

      {status === 'loading' && (
        <div className="space-y-2">
          {WATCHLIST.slice(0, 4).map(w => (
            <Skeleton key={w.ticker} className="h-14 w-full" />
          ))}
        </div>
      )}

      {status === 'ready' && (
        <div className="space-y-1.5">
          {ordered.map(item => {
            const q = quotes[item.ticker]
            const positive = (q?.changePercent ?? 0) >= 0
            return (
              <button
                key={item.ticker}
                onClick={() => onOpen(item.ticker)}
                className="w-full flex items-center gap-3 rounded-xl bg-bg border border-white/5 p-3 text-left hover:border-white/15 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{item.ticker}</p>
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">{item.kind}</span>
                  </div>
                  <p className="text-[11px] text-muted truncate">{item.note}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">{q ? formatCurrency(q.price) : '—'}</p>
                  {q && (
                    <span className={`flex items-center justify-end gap-0.5 text-xs font-semibold ${positive ? 'text-green' : 'text-danger'}`}>
                      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {formatSignedPct(q.changePercent)}
                    </span>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </Card>
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
