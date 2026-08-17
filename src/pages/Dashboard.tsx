import { useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card, ProgressBar, BalanceCard } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { isSameMonth, sumByType, formatCurrency, getNextPayDate, daysUntil } from '../utils/finance'
import { generateInsights, overallHealth } from '../utils/insights'
import { summarizeBenefits } from '../utils/benefits'
import TransactionForm from '../components/TransactionForm'
import { Plus, ArrowUpRight, ArrowDownRight, Sparkles, Gift, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard() {
  const { state } = useStore()
  const [formOpen, setFormOpen] = useState(false)
  const benefits = summarizeBenefits(state.benefits)

  const thisMonthTx = state.transactions.filter(t => isSameMonth(t.date))
  const income = sumByType(thisMonthTx, 'income') + state.settings.mainIncome
  const expenses = sumByType(thisMonthTx, 'expense')
  const available = income - expenses
  const percentUsed = income > 0 ? Math.min(100, (expenses / income) * 100) : 0

  const nextPay = useMemo(() => getNextPayDate(state.settings.payDay), [state.settings.payDay])
  const daysToPay = daysUntil(nextPay)

  const insights = useMemo(
    () => generateInsights(state.transactions, state.categories, income, state.budgets),
    [state.transactions, state.categories, income, state.budgets]
  )

  const lastMonthRef = new Date()
  lastMonthRef.setMonth(lastMonthRef.getMonth() - 1)
  const lastMonthExpenses = sumByType(
    state.transactions.filter(t => t.type === 'expense' && isSameMonth(t.date, lastMonthRef)),
    'expense'
  )
  const trendWorse = expenses > lastMonthExpenses
  const health = overallHealth(income, expenses, trendWorse)

  const topCategories = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of thisMonthTx.filter(t => t.type === 'expense')) {
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, amount]) => ({ cat: state.categories.find(c => c.id === id), amount }))
  }, [thisMonthTx, state.categories])

  return (
    <div className="pb-28">
      <Header title={`${greeting()} 👋`} subtitle="Aqui está sua visão financeira" />
      <div className="px-5 space-y-4">
        <BalanceCard
          balance={available}
          spentLabel={`${formatCurrency(expenses)} de ${formatCurrency(income)} usados este mês`}
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
            max={income}
            tone={percentUsed >= 90 ? 'danger' : percentUsed >= 70 ? 'warn' : 'green'}
          />
          <p className="text-xs text-muted mt-2">
            {available >= 0
              ? `Você pode gastar mais ${formatCurrency(available)} este mês.`
              : `Você ultrapassou sua renda em ${formatCurrency(Math.abs(available))}.`}
          </p>
        </Card>

        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{health.emoji}</span>
            <div>
              <p className="text-sm font-semibold">Situação financeira: {health.label}</p>
              <p className="text-xs text-muted">Próximo pagamento em {daysToPay} dia{daysToPay === 1 ? '' : 's'}</p>
            </div>
          </div>
        </Card>

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
            <p className="text-sm font-medium mb-3">Onde você mais gastou</p>
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
              Ver análise completa →
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
