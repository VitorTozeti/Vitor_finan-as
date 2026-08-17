import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card, EmptyState, Modal, pushToast, ConfirmDialog } from '../components/Primitives'
import {
  CHART_COLORS,
  AXIS_TICK,
  GRID_STROKE,
  MoneyTooltip,
  AreaGradient,
  StatTile,
  BRAND_GREEN
} from '../components/ChartKit'
import { useStore } from '../store/useStore'
import { formatCurrency, formatCurrencyShort, formatSignedPct, parseAmountInput } from '../utils/finance'
import { getMultipleQuotes, QuoteResult } from '../services/marketApi'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'

/** Builds a value-over-time series for the whole portfolio by walking each
 * asset's price history and, for every date on the longest timeline, summing
 * quantity × (most recent close at-or-before that date). Cost basis is a flat
 * reference line so the user can see market value pulling away from (or below)
 * what they put in. */
function buildWealthSeries(
  portfolio: { ticker: string; quantity: number; avgPrice: number }[],
  quotes: Record<string, QuoteResult>
) {
  const invested = portfolio.reduce((acc, p) => acc + p.quantity * p.avgPrice, 0)
  // Reference timeline = the asset with the most history points.
  let timeline: string[] = []
  for (const p of portfolio) {
    const h = quotes[p.ticker]?.history
    if (h && h.length > timeline.length) timeline = h.map(x => x.date)
  }
  if (timeline.length === 0) return { points: [], invested }

  const points = timeline.map(date => {
    let value = 0
    for (const p of portfolio) {
      const h = quotes[p.ticker]?.history
      let close = p.avgPrice
      if (h && h.length > 0) {
        // last close at-or-before this date (fallback to first point)
        let picked = h[0].close
        for (const point of h) {
          if (point.date <= date) picked = point.close
          else break
        }
        close = picked
      }
      value += p.quantity * close
    }
    return { date, patrimonio: Math.round(value * 100) / 100, investido: invested }
  })
  return { points, invested }
}

const PROJECTION_YEARS = [1, 5, 10]

export default function Portfolio() {
  const { state, addPortfolioAsset, deletePortfolioAsset } = useStore()
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [avgPrice, setAvgPrice] = useState('')

  useEffect(() => {
    if (state.portfolio.length === 0) return
    getMultipleQuotes(state.portfolio.map(p => p.ticker)).then(results => {
      const map: Record<string, QuoteResult> = {}
      for (const r of results) map[r.ticker] = r
      setQuotes(map)
    })
  }, [state.portfolio])

  function handleAdd() {
    const qty = parseAmountInput(quantity)
    const price = parseAmountInput(avgPrice)
    if (!ticker.trim() || isNaN(qty) || isNaN(price)) {
      pushToast('Preencha todos os campos', 'error')
      return
    }
    addPortfolioAsset({ ticker: ticker.trim().toUpperCase(), quantity: qty, avgPrice: price })
    pushToast('Ativo adicionado à carteira')
    setTicker('')
    setQuantity('')
    setAvgPrice('')
    setFormOpen(false)
  }

  const invested = state.portfolio.reduce((acc, p) => acc + p.quantity * p.avgPrice, 0)
  const current = state.portfolio.reduce((acc, p) => {
    const q = quotes[p.ticker]
    return acc + p.quantity * (q?.price ?? p.avgPrice)
  }, 0)
  const profit = current - invested
  const profitPct = invested > 0 ? (profit / invested) * 100 : 0

  const distribution = state.portfolio.map((p, i) => {
    const q = quotes[p.ticker]
    return { name: p.ticker, value: p.quantity * (q?.price ?? p.avgPrice), color: CHART_COLORS[i % CHART_COLORS.length] }
  })

  const wealth = useMemo(() => buildWealthSeries(state.portfolio, quotes), [state.portfolio, quotes])

  // Best/worst performer by unrealized return %.
  const performers = useMemo(() => {
    const withPct = state.portfolio
      .map(p => {
        const q = quotes[p.ticker]
        const price = q?.price ?? p.avgPrice
        const pct = p.avgPrice > 0 ? ((price - p.avgPrice) / p.avgPrice) * 100 : 0
        return { ticker: p.ticker, pct }
      })
      .sort((a, b) => b.pct - a.pct)
    return { best: withPct[0], worst: withPct[withPct.length - 1] }
  }, [state.portfolio, quotes])

  // Annualized growth rate implied by the ~6-month series (start → now), used to
  // project future value. Falls back to a conservative 8% a.a. when there isn't
  // enough history to estimate.
  const annualRate = useMemo(() => {
    const pts = wealth.points
    if (pts.length < 30 || pts[0].patrimonio <= 0) return 0.08
    const startVal = pts[0].patrimonio
    const endVal = pts[pts.length - 1].patrimonio
    const months = pts.length / 21 // ~21 trading days per month
    const rate = Math.pow(endVal / startVal, 12 / Math.max(1, months)) - 1
    // Clamp to a sane band so a volatile month doesn't project absurd numbers.
    return Math.max(-0.2, Math.min(0.3, rate))
  }, [wealth.points])

  return (
    <div className="pb-28">
      <Header title="Carteira" subtitle="Seus ativos e rentabilidade" />
      <div className="px-5 space-y-4">
        {state.portfolio.length === 0 ? (
          <EmptyState
            title="Nenhum ativo cadastrado"
            description="Adicione seus investimentos para acompanhar rentabilidade e distribuição."
            actionLabel="Adicionar ativo"
            onAction={() => setFormOpen(true)}
          />
        ) : (
          <div className="space-y-4 stagger">
            <Card variant="elevated">
              <p className="text-xs text-muted mb-1">Patrimônio atual</p>
              <p className="font-display text-[2.3rem] leading-none font-bold">{formatCurrency(current)}</p>
              <div
                className={`flex items-center gap-1 text-sm font-semibold mt-2 ${
                  profit >= 0 ? 'text-green' : 'text-danger'
                }`}
              >
                {profit >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {profit >= 0 ? '+' : ''}
                {formatCurrency(profit)} ({formatSignedPct(profitPct)})
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <StatTile label="Valor investido" value={formatCurrency(invested)} />
                <StatTile
                  label="Rentabilidade"
                  value={formatSignedPct(profitPct)}
                  tone={profit >= 0 ? 'green' : 'danger'}
                />
              </div>
              {performers.best && performers.worst && state.portfolio.length > 1 && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <StatTile
                    label={`Melhor · ${performers.best.ticker}`}
                    value={formatSignedPct(performers.best.pct)}
                    tone="green"
                  />
                  <StatTile
                    label={`Pior · ${performers.worst.ticker}`}
                    value={formatSignedPct(performers.worst.pct)}
                    tone="danger"
                  />
                </div>
              )}
            </Card>

            {wealth.points.length > 1 && (
              <Card>
                <p className="text-sm font-medium mb-1">Evolução do patrimônio</p>
                <p className="text-xs text-muted mb-3">Valor de mercado vs. o que você investiu (últimos meses).</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={wealth.points}>
                      <defs>
                        <AreaGradient id="grad-wealth" color={BRAND_GREEN} />
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis
                        dataKey="date"
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={40}
                        tickFormatter={(d: string) => d.slice(5)}
                      />
                      <YAxis
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        domain={['auto', 'auto']}
                        tickFormatter={formatCurrencyShort}
                      />
                      <Tooltip content={<MoneyTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="investido"
                        name="Investido"
                        stroke="#889389"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        fill="none"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="patrimonio"
                        name="Patrimônio"
                        stroke={BRAND_GREEN}
                        strokeWidth={2.5}
                        fill="url(#grad-wealth)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            <Card variant="accent">
              <p className="text-sm font-medium mb-1">Quanto pode render</p>
              <p className="text-xs text-muted mb-3">
                Projeção do valor atual mantendo o ritmo recente de{' '}
                <span className="text-accent font-semibold">{formatSignedPct(annualRate * 100)} ao ano</span>, sem novos
                aportes.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PROJECTION_YEARS.map(y => {
                  const future = current * Math.pow(1 + annualRate, y)
                  return (
                    <StatTile
                      key={y}
                      label={`Em ${y} ano${y > 1 ? 's' : ''}`}
                      value={formatCurrency(future)}
                      hint={`${formatSignedPct(((future - current) / Math.max(1, current)) * 100)}`}
                      tone="accent"
                    />
                  )
                })}
              </div>
              <p className="text-[11px] text-muted mt-3 leading-relaxed">
                Estimativa baseada no desempenho recente da carteira — não é promessa de retorno. Desempenho passado não
                garante resultados futuros.
              </p>
            </Card>

            {distribution.length > 0 && (
              <Card>
                <p className="text-sm font-medium mb-3">Distribuição da carteira</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {distribution.map((d, i) => (
                          <Cell key={i} fill={d.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<MoneyTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            <div className="space-y-2">
              {state.portfolio.map(p => {
                const q = quotes[p.ticker]
                const value = p.quantity * (q?.price ?? p.avgPrice)
                const cost = p.quantity * p.avgPrice
                const pProfit = value - cost
                const pPct = cost > 0 ? (pProfit / cost) * 100 : 0
                return (
                  <Card key={p.id} className="!p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{p.ticker}</p>
                      <p className="text-xs text-muted">
                        {p.quantity} un · preço médio {formatCurrency(p.avgPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-sm font-medium">{formatCurrency(value)}</p>
                      <p className={`text-xs ${pProfit >= 0 ? 'text-green' : 'text-danger'}`}>
                        {pProfit >= 0 ? '+' : ''}
                        {formatCurrency(pProfit)} ({formatSignedPct(pPct)})
                      </p>
                    </div>
                    <button onClick={() => setPendingDelete(p.id)} className="ml-3 text-muted text-xs" aria-label="Remover">
                      ✕
                    </button>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => setFormOpen(true)}
        aria-label="Adicionar ativo"
        className="fixed bottom-24 right-5 md:bottom-8 h-14 w-14 rounded-full bg-green text-bg flex items-center justify-center shadow-glow active:scale-95 transition-transform z-30"
      >
        <Plus size={26} />
      </button>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Adicionar ativo">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Ticker</label>
            <input
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="Ex: PETR4"
              className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Quantidade</label>
              <input
                inputMode="decimal"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Preço médio</label>
              <input
                inputMode="decimal"
                value={avgPrice}
                onChange={e => setAvgPrice(e.target.value)}
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
          </div>
          <button onClick={handleAdd} className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg active:scale-95 transition-transform">
            Adicionar
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remover ativo?"
        description="Isso não afeta seus investimentos reais, apenas o registro aqui."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deletePortfolioAsset(pendingDelete)
            pushToast('Ativo removido')
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
