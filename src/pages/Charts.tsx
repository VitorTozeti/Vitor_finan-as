import { useMemo } from 'react'
import Header from '../components/Header'
import { Card, EmptyState } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { isSameMonth, monthKey, monthLabel, formatCurrency } from '../utils/finance'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from 'recharts'

const COLORS = ['#00D26A', '#00A854', '#8B9690', '#FFC857', '#FF4D5A', '#4E9AF1', '#B98CE0', '#F5A623', '#5CD0B3', '#E37EC1', '#7A8CFF']

export default function Charts() {
  const { state } = useStore()

  const thisMonthExpenses = state.transactions.filter(t => t.type === 'expense' && isSameMonth(t.date))

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of thisMonthExpenses) {
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    return Array.from(map.entries())
      .map(([id, value]) => ({
        name: state.categories.find(c => c.id === id)?.name ?? id,
        value
      }))
      .sort((a, b) => b.value - a.value)
  }, [thisMonthExpenses, state.categories])

  const dailySeries = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of thisMonthExpenses) {
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
  }, [thisMonthExpenses])

  const monthlyComparison = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const t of state.transactions) {
      const key = monthKey(t.date)
      const entry = map.get(key) ?? { income: 0, expense: 0 }
      if (t.type === 'income') entry.income += t.amount
      else entry.expense += t.amount
      map.set(key, entry)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, v]) => ({ month: monthLabel(key), Entradas: v.income, Gastos: v.expense }))
  }, [state.transactions])

  const balanceEvolution = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of [...state.transactions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const key = monthKey(t.date)
      const delta = t.type === 'income' ? t.amount : -t.amount
      map.set(key, (map.get(key) ?? 0) + delta)
    }
    let running = 0
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, delta]) => {
        running += delta
        return { month: monthLabel(key), saldo: running }
      })
  }, [state.transactions])

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
        <Card>
          <p className="text-sm font-medium mb-3">Gastos por categoria</p>
          {byCategory.length === 0 ? (
            <p className="text-xs text-muted">Nenhum gasto este mês ainda.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{ background: '#151A17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            {byCategory.map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {c.name}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium mb-3">Gastos acumulados no mês</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8B9690' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8B9690' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: '#151A17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="total" stroke="#00D26A" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium mb-3">Entradas x gastos</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8B9690' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8B9690' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: '#151A17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                />
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
              <LineChart data={balanceEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8B9690' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8B9690' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: '#151A17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="saldo" stroke="#00D26A" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
