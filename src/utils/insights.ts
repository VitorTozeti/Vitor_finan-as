import { Transaction, Category, Budget } from '../types'
import { isSameMonth, sumByType, formatCurrency } from './finance'

export interface Insight {
  id: string
  text: string
  tone: 'neutral' | 'positive' | 'warning'
}

function lastMonthRef(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d
}

export function generateInsights(
  transactions: Transaction[],
  categories: Category[],
  monthlyIncome: number,
  budgets: Budget[]
): Insight[] {
  const insights: Insight[] = []
  const thisMonthExpenses = transactions.filter(t => t.type === 'expense' && isSameMonth(t.date))
  const lastMonthExpenses = transactions.filter(t => t.type === 'expense' && isSameMonth(t.date, lastMonthRef()))

  const totalThisMonth = sumByType(thisMonthExpenses, 'expense')
  const totalLastMonth = sumByType(lastMonthExpenses, 'expense')

  // % of income spent per category
  const byCategory = new Map<string, number>()
  for (const t of thisMonthExpenses) {
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount)
  }
  if (monthlyIncome > 0) {
    for (const [catId, amount] of byCategory.entries()) {
      const pct = (amount / monthlyIncome) * 100
      if (pct >= 20) {
        const cat = categories.find(c => c.id === catId)
        insights.push({
          id: `cat-${catId}`,
          text: `Você gastou ${pct.toFixed(0)}% da sua renda com ${cat?.name ?? 'uma categoria'} este mês.`,
          tone: pct >= 35 ? 'warning' : 'neutral'
        })
      }
    }
  }

  // Category change vs last month
  const byCategoryLastMonth = new Map<string, number>()
  for (const t of lastMonthExpenses) {
    byCategoryLastMonth.set(t.categoryId, (byCategoryLastMonth.get(t.categoryId) ?? 0) + t.amount)
  }
  for (const [catId, amount] of byCategory.entries()) {
    const prev = byCategoryLastMonth.get(catId)
    if (prev && prev > 0) {
      const change = ((amount - prev) / prev) * 100
      if (Math.abs(change) >= 15) {
        const cat = categories.find(c => c.id === catId)
        insights.push({
          id: `trend-${catId}`,
          text: `Seus gastos com ${cat?.name ?? 'essa categoria'} ${change > 0 ? 'aumentaram' : 'diminuíram'} ${Math.abs(change).toFixed(0)}% em relação ao mês passado.`,
          tone: change > 0 ? 'warning' : 'positive'
        })
      }
    }
  }

  // Overall trend
  if (totalLastMonth > 0) {
    if (totalThisMonth > totalLastMonth) {
      insights.push({
        id: 'trend-overall',
        text: 'Você está gastando mais do que no mês anterior.',
        tone: 'warning'
      })
    } else if (totalThisMonth < totalLastMonth) {
      insights.push({
        id: 'trend-overall-good',
        text: 'Você está gastando menos do que no mês anterior. Continue assim!',
        tone: 'positive'
      })
    }
  }

  // Projected balance
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (dayOfMonth >= 3 && totalThisMonth > 0) {
    const dailyRate = totalThisMonth / dayOfMonth
    const projectedTotal = dailyRate * daysInMonth
    const projectedBalance = monthlyIncome - projectedTotal
    insights.push({
      id: 'projection',
      text: `Se continuar nesse ritmo, seu saldo estimado no fim do mês será de ${formatCurrency(projectedBalance)}.`,
      tone: projectedBalance < 0 ? 'warning' : 'neutral'
    })
  }

  // Budget usage
  const totalBudget = budgets.reduce((a, b) => a + b.limit, 0)
  if (totalBudget > 0) {
    const pct = (totalThisMonth / totalBudget) * 100
    insights.push({
      id: 'budget-usage',
      text: `Você já utilizou ${pct.toFixed(0)}% do orçamento mensal.`,
      tone: pct >= 90 ? 'warning' : pct >= 70 ? 'neutral' : 'positive'
    })
  }

  return insights
}

/** Neutral, factual summary of the month — states the numbers without an
 * emotional verdict ("Crítico"/"Saudável"). `percentUsed` still drives the
 * progress-bar color elsewhere; here we only describe what's happening. */
export function financialSummary(
  totalIncome: number,
  totalExpenses: number
): { percentUsed: number; headline: string; detail: string } {
  const percentUsed = totalIncome > 0 ? Math.min(100, (totalExpenses / totalIncome) * 100) : 0
  const available = totalIncome - totalExpenses
  if (totalIncome <= 0) {
    return {
      percentUsed: 0,
      headline: 'Adicione sua renda para acompanhar o mês',
      detail: `Você gastou ${formatCurrency(totalExpenses)} até agora`
    }
  }
  return {
    percentUsed,
    headline: `Você usou ${percentUsed.toFixed(0)}% da renda este mês`,
    detail:
      available >= 0
        ? `Restam ${formatCurrency(available)} até o próximo pagamento`
        : `Você passou ${formatCurrency(Math.abs(available))} da sua renda`
  }
}
