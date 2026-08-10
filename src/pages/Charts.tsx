import { useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card, EmptyState } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { monthKey, monthLabel, formatCurrency, formatCurrencyShort, formatSignedPct } from '../utils/finance'
import {
  CHART_COLORS,
  AXIS_TICK,
  GRID_STROKE,
  MoneyTooltip,
  AreaGradient,
  SegmentedControl,
  StatTile,
  TOOLTIP_STYLE
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

type Period = 'month' | '3m' | '6m' | '12m'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Mês' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '12m', label: '12M' }
]

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
  const [period, setPeriod] = useState<Period>('month')

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

  if (state.transactions.length === 0) {
    return (
      <div className="pb-28">
        <Header title="Análise" subtitle="Gráficos e comparações" />
        <div className="px-5">
          <EmptyState
            title="Sem dados suficientes"
            description="Adicione gastos e receitas para visualizar seus gráficos aqui."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <Header title="Análise" subtitle="Gráficos e comparações" />
      <div className="px-5 space-y-4">
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
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, n: string) => [formatCurrency(v), n]}
                      contentStyle={TOOLTIP_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {byCategory.slice(0, 6).map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
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
                    <AreaGradient id="grad-daily" color="#00D26A" />
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} tickFormatter={formatCurrencyShort} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Area type="monotone" dataKey="total" name="Acumulado" stroke="#00D26A" strokeWidth={2.5} fill="url(#grad-daily)" />
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
                <Bar dataKey="Entradas" fill="#00D26A" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Gastos" fill="#FF4D5A" radius={[6, 6, 0, 0]} />
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
      </div>
    </div>
  )
}
