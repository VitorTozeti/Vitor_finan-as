import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card, ProgressBar, BalanceCard } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { isSameMonth, sumByType, formatCurrency, formatSignedPct, getNextPayDate, daysUntil, formatCurrencyShort } from '../utils/finance'
import { generateInsights, financialSummary } from '../utils/insights'
import { summarizeBenefits } from '../utils/benefits'
import TransactionForm from '../components/TransactionForm'
import { getMultipleQuotes, QuoteResult } from '../services/marketApi'
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Gift,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  LineChart as ChartIcon
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useChartTheme, MoneyTooltip } from '../components/ChartKit'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard() {
  const { state } = useStore()
  const chart = useChartTheme()
  const [formOpen, setFormOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})
  const benefits = summarizeBenefits(state.benefits)

  // Fetch quotes for portfolio assets to display live investment values and charts
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

  const thisMonthTx = useMemo(
    () => state.transactions.filter(t => isSameMonth(t.date, selectedDate)),
    [state.transactions, selectedDate]
  )

  const isCurrentMonth = useMemo(() => {
    const now = new Date()
    return selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() === now.getMonth()
  }, [selectedDate])

  const txIncome = sumByType(thisMonthTx, 'income')
  // If transactions already have explicit income entries (e.g. from bank sync), use that; otherwise add default mainIncome
  const income = txIncome > 0 ? txIncome : (isCurrentMonth ? state.settings.mainIncome : 0)
  const expenses = sumByType(thisMonthTx, 'expense')
  const available = income - expenses
  const percentUsed = income > 0 ? Math.min(100, (expenses / income) * 100) : 0

  const nextPay = useMemo(() => getNextPayDate(state.settings.payDay), [state.settings.payDay])
  const daysToPay = daysUntil(nextPay)

  const insights = useMemo(
    () => generateInsights(state.transactions, state.categories, income, state.budgets),
    [state.transactions, state.categories, income, state.budgets]
  )

  const summary = financialSummary(income, expenses)

  const topCategories = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of thisMonthTx.filter(t => t.type === 'expense')) {
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, amount]) => ({ cat: state.categories.find(c => c.id === id), amount }))
  }, [thisMonthTx, state.categories])

  // Portfolio calculations for Investment charts on Dashboard
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

  function prevMonth() {
    setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  function nextMonth() {
    setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  function resetToCurrentMonth() {
    setSelectedDate(new Date())
  }

  const monthTitle = selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const formattedMonthTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)

  return (
    <div className="pb-28">
      <Header title={`${greeting()} 👋`} subtitle="Aqui está sua visão financeira" />
      <div className="px-5 space-y-4">
        {/* Seletor de Mês */}
        <div className="flex items-center justify-between rounded-2xl bg-card border border-line/5 p-2 px-3">
          <button
            onClick={prevMonth}
            aria-label="Mês anterior"
            className="h-8 w-8 rounded-xl bg-bg flex items-center justify-center text-muted hover:text-txt active:scale-95 transition-transform"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold capitalize">{formattedMonthTitle}</p>
            {!isCurrentMonth && (
              <button
                onClick={resetToCurrentMonth}
                className="text-[10px] text-green font-medium hover:underline"
              >
                Voltar ao mês atual
              </button>
            )}
          </div>
          <button
            onClick={nextMonth}
            aria-label="Próximo mês"
            className="h-8 w-8 rounded-xl bg-bg flex items-center justify-center text-muted hover:text-txt active:scale-95 transition-transform"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <BalanceCard
          balance={available}
          spentLabel={`${formatCurrency(expenses)} de ${formatCurrency(income)} usados ${
            isCurrentMonth ? 'este mês' : 'neste mês'
          }`}
        />

        <div className="grid grid-cols-2 gap-3">
          <Card className="!p-4">
            <div className="flex items-center gap-1.5 text-muted text-xs mb-1">
              <ArrowUpRight size={14} className="text-green" /> Entradas
            </div>
            <p className="font-display text-lg font-bold">{formatCurrency(income)}</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-1.5 text-muted text-xs mb-1">
              <ArrowDownRight size={14} className="text-danger" /> Gastos
            </div>
            <p className="font-display text-lg font-bold">{formatCurrency(expenses)}</p>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Uso da renda mensal</p>
            <p className="text-sm text-muted">{percentUsed.toFixed(0)}%</p>
          </div>
          <ProgressBar
            value={expenses}
            max={income > 0 ? income : 1}
            tone={percentUsed >= 90 ? 'danger' : percentUsed >= 70 ? 'warn' : 'green'}
          />
          <p className="text-xs text-muted mt-2">
            {income === 0 && expenses === 0
              ? 'Nenhum lançamento registrado neste mês.'
              : available >= 0
              ? `Você pode gastar mais ${formatCurrency(available)} neste mês.`
              : `Você ultrapassou sua renda em ${formatCurrency(Math.abs(available))}.`}
          </p>
        </Card>

        {/* Bloco de Investimentos & Gráficos na tela Inicial */}
        <Card variant={state.portfolio.length > 0 ? 'default' : 'accent'}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-green/10 flex items-center justify-center text-green">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold">Investimentos & Carteira</p>
                <p className="text-[11px] text-muted">
                  {state.portfolio.length > 0
                    ? `${state.portfolio.length} ativo(s) acompanhados`
                    : 'Acompanhe seus ativos e rendimentos'}
                </p>
              </div>
            </div>
            <Link
              to="/carteira"
              className="text-xs font-semibold text-green flex items-center gap-1 hover:underline"
            >
              Ver carteira <ChevronRight size={14} />
            </Link>
          </div>

          {state.portfolio.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 bg-bg rounded-xl p-3">
                <div>
                  <p className="text-[11px] text-muted">Patrimônio atual</p>
                  <p className="font-display text-base font-bold text-txt">
                    {formatCurrency(portfolioCurrent)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Rentabilidade</p>
                  <p
                    className={`font-display text-base font-bold flex items-center gap-1 ${
                      portfolioProfit >= 0 ? 'text-green' : 'text-danger'
                    }`}
                  >
                    {portfolioProfit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {formatSignedPct(portfolioProfitPct)}
                  </p>
                </div>
              </div>

              {/* Gráfico de Distribuição dos Investimentos */}
              {portfolioDistribution.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-muted mb-2">
                    <span className="flex items-center gap-1">
                      <PieIcon size={13} /> Distribuição da Carteira
                    </span>
                    <span>{state.portfolio.length} ativo(s)</span>
                  </div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolioDistribution}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={36}
                          outerRadius={64}
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
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
                    {portfolioDistribution.slice(0, 5).map(d => (
                      <span key={d.name} className="flex items-center gap-1 text-[11px] text-muted">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                        {d.name} ({formatCurrencyShort(d.value)})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted">
                Adicione suas ações, fundos imobiliários ou renda fixa para acompanhar a rentabilidade.
              </p>
              <Link
                to="/carteira"
                className="shrink-0 rounded-xl bg-green text-bg px-3.5 py-2 text-xs font-semibold"
              >
                Adicionar ativos
              </Link>
            </div>
          )}
        </Card>

        {summary.headline && (
          <Card>
            <p className="text-sm font-semibold">{summary.headline}</p>
            <p className="text-xs text-muted mt-1">{summary.detail}</p>
            {isCurrentMonth && (
              <p className="text-xs text-muted mt-0.5">
                Próximo pagamento em {daysToPay} dia{daysToPay === 1 ? '' : 's'}
              </p>
            )}
          </Card>
        )}

        {benefits.count > 0 && (
          <Link to="/beneficios" className="block">
            <Card variant="accent" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
                <Gift size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  Você recebe {formatCurrency(benefits.monthlyTotal)}/mês em benefícios
                </p>
                <p className="text-xs text-muted">Veja saldo, cashback e suas conquistas</p>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </Card>
          </Link>
        )}

        {topCategories.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Onde você mais gastou</p>
              <span className="text-xs text-muted">{thisMonthTx.filter(t => t.type === 'expense').length} gasto(s)</span>
            </div>
            <div className="space-y-3">
              {topCategories.map(({ cat, amount }) => (
                <div key={cat?.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span>{cat?.icon}</span> {cat?.name}
                    </span>
                    <span className="font-medium text-txt">{formatCurrency(amount)}</span>
                  </div>
                  <ProgressBar value={amount} max={Math.max(expenses, 1)} />
                </div>
              ))}
            </div>
            <Link to="/graficos" className="block text-center text-xs font-medium text-green mt-4">
              Ver análise completa de gráficos →
            </Link>
          </Card>
        )}

        {insights.length > 0 && (
          <Card>
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles size={15} className="text-green" />
              <p className="text-sm font-medium">Insights financeiros</p>
            </div>
            <div className="space-y-2.5">
              {insights.slice(0, 4).map(i => (
                <p key={i.id} className="text-xs text-muted leading-relaxed">
                  {i.tone === 'warning' ? '⚠️ ' : i.tone === 'positive' ? '✅ ' : '💡 '}
                  {i.text}
                </p>
              ))}
            </div>
          </Card>
        )}

        <p className="text-center text-[11px] text-muted px-4">
          Seus dados financeiros são armazenados localmente neste dispositivo.
        </p>
      </div>

      <button
        onClick={() => setFormOpen(true)}
        aria-label="Adicionar gasto"
        className="fixed bottom-24 right-5 md:bottom-8 h-14 w-14 rounded-full bg-green text-bg flex items-center justify-center shadow-soft active:scale-95 transition-transform z-30"
      >
        <Plus size={26} />
      </button>

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}
