import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Card, EmptyState, Skeleton } from '../components/Primitives'
import { AXIS_TICK, GRID_STROKE, useChartTheme } from '../components/ChartKit'
import { useStore } from '../store/useStore'
import { formatCurrency, formatSignedPct } from '../utils/finance'
import { TrendingUp, TrendingDown, ChevronRight, RefreshCw } from 'lucide-react'
import { getQuote, getMultipleQuotes, getQuotesBatch, QuoteResult } from '../services/marketApi'
import { WATCHLIST } from '../data/investing'
import TickerAutocomplete from '../components/TickerAutocomplete'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const BENCHMARK = 'BOVA11'

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
          <TickerAutocomplete
            value={query}
            onPick={entry => handleSearch(entry.ticker)}
            onTextChange={setQuery}
            onSubmit={t => handleSearch(t)}
          />
          <p className="text-[11px] text-muted mt-1.5">
            Busque por código ou nome. Pressione Enter para abrir a análise.
          </p>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="rounded-full border border-line/10 px-3 py-1.5 text-xs font-medium text-muted hover:text-green hover:border-green"
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

        {state.portfolio.length > 0 && <PortfolioVsIndex />}

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
                className="w-full flex items-center gap-3 rounded-xl bg-bg border border-line/5 p-3 text-left hover:border-line/15 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{item.ticker}</p>
                    <span className="rounded-md bg-line/5 px-1.5 py-0.5 text-[10px] text-muted">{item.kind}</span>
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

/** Compares the user's portfolio performance against the Ibovespa (BOVA11),
 * both rebased to 100 at the start of the shared window so the lines are
 * comparable regardless of absolute price. */
function PortfolioVsIndex() {
  const { state } = useStore()
  const chart = useChartTheme()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [holdings, setHoldings] = useState<QuoteResult[]>([])
  const [bench, setBench] = useState<QuoteResult | null>(null)

  useEffect(() => {
    let alive = true
    setStatus('loading')
    Promise.all([getMultipleQuotes(state.portfolio.map(p => p.ticker)), getQuote(BENCHMARK)])
      .then(([hs, b]) => {
        if (!alive) return
        setHoldings(hs)
        setBench(b)
        setStatus(hs.some(h => h.history?.length) && b?.history?.length ? 'ready' : 'error')
      })
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [state.portfolio])

  const series = useMemo(() => {
    if (!bench?.history?.length) return []
    const byTicker: Record<string, QuoteResult> = {}
    for (const h of holdings) byTicker[h.ticker] = h
    // Portfolio market value over the benchmark's timeline.
    const timeline = bench.history.map(x => x.date)
    const values = timeline.map(date => {
      let value = 0
      for (const p of state.portfolio) {
        const hist = byTicker[p.ticker]?.history
        let close = p.avgPrice
        if (hist && hist.length) {
          let picked = hist[0].close
          for (const point of hist) {
            if (point.date <= date) picked = point.close
            else break
          }
          close = picked
        }
        value += p.quantity * close
      }
      return value
    })
    const base = values.find(v => v > 0) ?? 1
    const benchBase = bench.history[0].close || 1
    return timeline.map((date, i) => ({
      date,
      Carteira: Math.round((values[i] / base) * 1000) / 10,
      Ibovespa: Math.round((bench.history![i].close / benchBase) * 1000) / 10
    }))
  }, [holdings, bench, state.portfolio])

  return (
    <Card>
      <p className="text-sm font-medium mb-1">Carteira vs. Ibovespa</p>
      <p className="text-xs text-muted mb-3">Desempenho relativo nos últimos meses (base 100).</p>
      {status === 'loading' && <Skeleton className="h-52 w-full" />}
      {status === 'error' && (
        <p className="text-xs text-muted">Sem histórico suficiente para comparar agora.</p>
      )}
      {status === 'ready' && series.length > 1 && (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={38} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v: number, name: string) => [v.toFixed(1), name]}
                contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 12, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="Carteira" stroke={chart.green} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Ibovespa" stroke={chart.axisFill} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
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
