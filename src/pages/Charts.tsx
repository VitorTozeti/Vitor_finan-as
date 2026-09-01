import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card, EmptyState } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { monthKey, monthLabel, formatCurrency, formatCurrencyShort, formatSignedPct } from '../utils/finance'
import { getMultipleQuotes, QuoteResult } from '../services/marketApi'
import { findTicker } from '../utils/tickers'
import {
  AXIS_TICK,
  GRID_STROKE,
  MoneyTooltip,
  AreaGradient,
  SegmentedControl,
  StatTile,
  useChartTheme
} from '../components/ChartKit'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  AreaChart,
  Area
} from 'recharts'

type ChartSection = 'expenses' | 'investments'
type Period = 'month' | '3m' | '6m' | '12m'

const SECTION_OPTIONS: { value: ChartSection; label: string }[] = [
  { value: 'expenses', label: 'Gastos & Fluxo' },
  { value: 'investments', label: 'Investimentos' }
]

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Mês' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '12m', label: '12M' }
]

function assetClass(ticker: string): 'Ações' | 'FIIs' | 'ETFs' {
  const entry = findTicker(ticker)
  if (entry?.kind === 'FII') return 'FIIs'
  if (entry?.kind === 'ETF') return 'ETFs'
  if (entry?.kind === 'FII/ETF') return /11$/.test(ticker) ? 'FIIs' : 'ETFs'
  return 'Ações'
}

function windowStart(period: Period): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (period === 'month') {
    d.setDate(1)
    return d
  }
  const back = period === '3m' ? 2 : period === '6m' ? 5 : 11
  d.setDate(1)
  d.setMonth(d.getMonth() - back)
  return d
}

export default function Charts() {
  const { state } = useStore()
  const chart = useChartTheme()
  const [section, setSection] = useState<ChartSection>('expenses')
  const [period, setPeriod] = useState<Period>('month')
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})

  useEffect(() => {
    if (state.portfolio.length === 0) return
    let alive = true
    getMultipleQuotes(state.portfolio.map(p => p.ticker)).then(results => {
      if (!alive) return
      const map: Record<string, QuoteResult> = {}
      for (const r of results) map[r.ticker] = r
      setQuotes(map)
    })
    return () => {
      alive = false
    }
  }, [state.portfolio])

  const start = useMemo(() => windowStart(period), [period])

  const windowTx = useMemo(
    () => state.transactions.filter(t => new Date(t.date) >= start),
    [state.transactions, start]
  )
  const windowExpenses = windowTx.filter(t => t.type === 'expense')

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of windowTx) {
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    }
    const balance = income - expense
    const savingsRate = income > 0 ? (balance / income) * 100 : 0
    return { income, expense, balance, savingsRate }
  }, [windowTx])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of windowExpenses) {
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    const total = windowExpenses.reduce((a, t) => a + t.amount, 0)
    return Array.from(map.entries())
      .map(([id, value]) => ({
        name: state.categories.find(c => c.id === id)?.name ?? id,
        value,
        pct: total > 0 ? (value / total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
  }, [windowExpenses, state.categories])

  const dailySeries = useMemo(() => {
    if (period !== 'month') return []
    const map = new Map<string, number>()
    for (const t of windowExpenses) {
      const day = t.date.slice(8, 10)
      map.set(day, (map.get(day) ?? 0) + t.amount)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .reduce<{ day: string; total: number }[]>((acc, [day, amount]) => {
        const prevTotal = acc.length > 0 ? acc[acc.length - 1].total : 0
        acc.push({ day, total: prevTotal + amount })
        return acc
      }, [])
  }, [windowExpenses, period])

  const monthlyComparison = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const t of windowTx) {
      const key = monthKey(t.date)
      const entry = map.get(key) ?? { income: 0, expense: 0 }
      if (t.type === 'income') entry.income += t.amount
      else entry.expense += t.amount
      map.set(key, entry)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({ month: monthLabel(key), Entradas: v.income, Gastos: v.expense }))
  }, [windowTx])

  const balanceEvolution = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of state.transactions) {
      const key = monthKey(t.date)
      const delta = t.type === 'income' ? t.amount : -t.amount
      map.set(key, (map.get(key) ?? 0) + delta)
    }
    let running = 0
    const startKey = monthKey(start.toISOString())
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, delta]) => {
        running += delta
        return { key, month: monthLabel(key), saldo: Math.round(running * 100) / 100 }
      })
      .filter(p => p.key >= startKey)
  }, [state.transactions, start])

  // Calculations for Investment charts
  const portfolioInvested = useMemo(
    () => state.portfolio.reduce((acc, p) => acc + p.quantity * p.avgPrice, 0),
    [state.portfolio]
  )

  const portfolioCurrent = useMemo(
    () =>
      state.portfolio.reduce((acc, p) => {
        const q = quotes[p.ticker]
        return acc + p.quantity * (q?.price ?? p.avgPrice)
      }, 0),
    [state.portfolio, quotes]
  )

  const portfolioProfit = portfolioCurrent - portfolioInvested
  const portfolioProfitPct = portfolioInvested > 0 ? (portfolioProfit / portfolioInvested) * 100 : 0

  const portfolioDistribution = useMemo(
    () =>
      state.portfolio.map((p, i) => {
        const q = quotes[p.ticker]
        return {
          name: p.ticker,
          value: p.quantity * (q?.price ?? p.avgPrice),
          color: chart.colors[i % chart.colors.length]
        }
      }),
    [state.portfolio, quotes, chart]
  )

  const classAllocation = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of state.portfolio) {
      const q = quotes[p.ticker]
      const value = p.quantity * (q?.price ?? p.avgPrice)
      const cls = assetClass(p.ticker)
      map.set(cls, (map.get(cls) ?? 0) + value)
    }
    const classColor: Record<string, string> = { Ações: chart.green, FIIs: chart.accent, ETFs: chart.colors[2] }
    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
      color: classColor[name] ?? chart.colors[3]
    }))
  }, [state.portfolio, quotes, chart])

  const profitByAsset = useMemo(() => {
    return state.portfolio
      .map(p => {
        const price = quotes[p.ticker]?.price ?? p.avgPrice
        const pct = p.avgPrice > 0 ? ((price - p.avgPrice) / p.avgPrice) * 100 : 0
        return { ticker: p.ticker, pct: Math.round(pct * 100) / 100 }
      })
      .sort((a, b) => b.pct - a.pct)
  }, [state.portfolio, quotes])

  if (state.transactions.length === 0 && state.portfolio.length === 0) {
    return (
      <div className="pb-28">
        <Header title="Análise" subtitle="Gráficos e comparações" />
        <div className="px-5">
          <EmptyState
            title="Sem dados suficientes"
            description="Adicione gastos, receitas ou investimentos para visualizar seus gráficos aqui."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <Header title="Análise" subtitle="Gráficos e comparações" />
      <div className="px-5 space-y-4">
        {/* Alternador de Seção: Gastos & Fluxo vs Investimentos */}
        <div className="flex justify-center">
          <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={setSection} />
        </div>

        {section === 'expenses' ? (
          <>
            <div className="flex justify-center">
              <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Entradas" value={formatCurrency(totals.income)} tone="green" />
              <StatTile label="Gastos" value={formatCurrency(totals.expense)} tone="danger" />
              <StatTile
                label="Saldo do período"
                value={formatCurrency(totals.balance)}
                tone={totals.balance >= 0 ? 'green' : 'danger'}
              />
              <StatTile
                label="Taxa de poupança"
                value={formatSignedPct(totals.savingsRate, 0)}
                hint={totals.savingsRate >= 20 ? 'ótimo ritmo' : totals.savingsRate >= 0 ? 'dá pra melhorar' : 'no vermelho'}
                tone={totals.savingsRate >= 0 ? 'green' : 'danger'}
              />
            </div>

            <Card>
              <p className="text-sm font-medium mb-3">Gastos por categoria</p>
              {byCategory.length === 0 ? (
                <p className="text-xs text-muted">Nenhum gasto neste período ainda.</p>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                          {byCategory.map((_, i) => (
                            <Cell key={i} fill={chart.colors[i % chart.colors.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number, n: string) => [formatCurrency(v), n]}
                          contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 12, fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {byCategory.slice(0, 6).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: chart.colors[i % chart.colors.length] }} />
                        <span className="text-muted truncate">{c.name}</span>
                        <span className="ml-auto text-muted">{c.pct.toFixed(0)}%</span>
                        <span className="font-medium text-txt w-20 text-right">{formatCurrency(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {period === 'month' && (
              <Card>
                <p className="text-sm font-medium mb-3">Gastos acumulados no mês</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailySeries}>
                      <defs>
                        <AreaGradient id="grad-daily" color={chart.green} />
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} tickFormatter={formatCurrencyShort} />
                      <Tooltip content={<MoneyTooltip />} />
                      <Area type="monotone" dataKey="total" name="Acumulado" stroke={chart.green} strokeWidth={2.5} fill="url(#grad-daily)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            <Card>
              <p className="text-sm font-medium mb-3">Entradas x gastos</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} tickFormatter={formatCurrencyShort} />
                    <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Entradas" fill={chart.green} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Gastos" fill={chart.danger} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <p className="text-sm font-medium mb-3">Evolução do saldo</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceEvolution}>
                    <defs>
                      <AreaGradient id="grad-balance" color="#4E9AF1" />
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} tickFormatter={formatCurrencyShort} />
                    <Tooltip content={<MoneyTooltip />} />
                    <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#4E9AF1" strokeWidth={2.5} fill="url(#grad-balance)" dot={{ r: 2.5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </>
        ) : (
          /* Seção de Investimentos */
          <>
            {state.portfolio.length === 0 ? (
              <EmptyState
                title="Nenhum ativo na carteira"
                description="Adicione seus investimentos na aba Carteira para visualizar a análise completa de rentabilidade e alocação."
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="Patrimônio Total" value={formatCurrency(portfolioCurrent)} />
                  <StatTile label="Total Investido" value={formatCurrency(portfolioInvested)} />
                  <StatTile
                    label="Rentabilidade"
                    value={formatSignedPct(portfolioProfitPct)}
                    hint={`${portfolioProfit >= 0 ? '+' : ''}${formatCurrency(portfolioProfit)}`}
                    tone={portfolioProfit >= 0 ? 'green' : 'danger'}
                  />
                  <StatTile label="Total de Ativos" value={String(state.portfolio.length)} tone="accent" />
                </div>

                {portfolioDistribution.length > 0 && (
                  <Card>
                    <p className="text-sm font-medium mb-3">Distribuição por ativo</p>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={portfolioDistribution}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={2}
                          >
                            {portfolioDistribution.map((d, i) => (
                              <Cell key={i} fill={d.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip content={<MoneyTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
                      {portfolioDistribution.map(d => (
                        <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                          {d.name} ({formatCurrencyShort(d.value)})
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

                {classAllocation.length > 1 && (
                  <Card>
                    <p className="text-sm font-medium mb-3">Alocação por classe de ativos</p>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={classAllocation}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {classAllocation.map((d, i) => (
                              <Cell key={i} fill={d.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip content={<MoneyTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
                      {classAllocation.map(d => (
                        <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                          {d.name} ({formatCurrencyShort(d.value)})
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

                {profitByAsset.length > 0 && (
                  <Card>
                    <p className="text-sm font-medium mb-1">Rentabilidade por ativo</p>
                    <p className="text-xs text-muted mb-3">Retorno acumulado sobre o preço médio.</p>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={profitByAsset} layout="vertical" margin={{ left: 8, right: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                          <YAxis type="category" dataKey="ticker" tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} />
                          <Tooltip
                            cursor={{ fill: GRID_STROKE }}
                            formatter={(v: number) => [`${formatSignedPct(v)}`, 'Rentabilidade']}
                            contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 12, fontSize: 12 }}
                          />
                          <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
                            {profitByAsset.map((d, i) => (
                              <Cell key={i} fill={d.pct >= 0 ? chart.green : chart.danger} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
