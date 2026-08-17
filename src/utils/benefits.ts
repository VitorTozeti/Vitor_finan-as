import { AppState, Benefit, CashbackProgram, Goal, PortfolioAsset, Transaction } from '../types'
import { isSameMonth, monthKey, sumByType } from './finance'

/** Normalizes a benefit's value to a monthly figure regardless of frequency,
 * so totals across mensal/anual/único benefits are comparable. */
export function monthlyValue(b: Benefit): number {
  if (b.frequency === 'anual') return b.amount / 12
  if (b.frequency === 'único') return 0 // one-off — not part of the recurring monthly figure
  return b.amount
}

export interface BenefitsSummary {
  monthlyTotal: number
  annualTotal: number
  reloadableBalance: number
  count: number
}

export function summarizeBenefits(benefits: Benefit[]): BenefitsSummary {
  const monthlyTotal = benefits.reduce((acc, b) => acc + monthlyValue(b), 0)
  const oneOff = benefits.filter(b => b.frequency === 'único').reduce((acc, b) => acc + b.amount, 0)
  const reloadableBalance = benefits.reduce((acc, b) => acc + (b.currentBalance ?? 0), 0)
  return {
    monthlyTotal,
    annualTotal: monthlyTotal * 12 + oneOff,
    reloadableBalance,
    count: benefits.length
  }
}

export function cashbackTotal(program: CashbackProgram): number {
  return program.entries.reduce((acc, e) => acc + e.amount, 0)
}

// ---- Achievements ------------------------------------------------------------

export interface AchievementDef {
  id: string
  emoji: string
  title: string
  description: string
}

export interface AchievementStatus extends AchievementDef {
  unlocked: boolean
  /** 0–100 progress toward unlocking (100 when unlocked). */
  progress: number
}

interface AchievementContext {
  transactions: Transaction[]
  goals: Goal[]
  portfolio: PortfolioAsset[]
  monthlyIncome: number
  benefitsCount: number
  hasBudget: boolean
  budgetTotal: number
}

/** Number of consecutive most-recent months (ending last month) where total
 * expenses were lower than the month before. */
function savingStreak(transactions: Transaction[]): number {
  const byMonth = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const k = monthKey(t.date)
    byMonth.set(k, (byMonth.get(k) ?? 0) + t.amount)
  }
  const keys = Array.from(byMonth.keys()).sort() // ascending
  // Exclude the current (incomplete) month from the streak comparison.
  const nowKey = monthKey(new Date().toISOString())
  const completed = keys.filter(k => k < nowKey)
  let streak = 0
  for (let i = completed.length - 1; i >= 1; i--) {
    const cur = byMonth.get(completed[i]) ?? 0
    const prev = byMonth.get(completed[i - 1]) ?? 0
    if (cur < prev) streak++
    else break
  }
  return streak
}

const DEFINITIONS: { def: AchievementDef; evaluate: (c: AchievementContext) => { unlocked: boolean; progress: number } }[] = [
  {
    def: { id: 'first-step', emoji: '🌱', title: 'Primeiro passo', description: 'Registre sua primeira movimentação.' },
    evaluate: c => ({ unlocked: c.transactions.length >= 1, progress: c.transactions.length >= 1 ? 100 : 0 })
  },
  {
    def: { id: 'organizer', emoji: '🗂️', title: 'Organizado', description: 'Registre pelo menos 10 movimentações.' },
    evaluate: c => ({ unlocked: c.transactions.length >= 10, progress: Math.min(100, (c.transactions.length / 10) * 100) })
  },
  {
    def: { id: 'goal-reached', emoji: '🎯', title: 'Meta batida', description: 'Alcance 100% de uma meta financeira.' },
    evaluate: c => {
      const best = c.goals.reduce((m, g) => Math.max(m, g.target > 0 ? (g.saved / g.target) * 100 : 0), 0)
      return { unlocked: c.goals.some(g => g.target > 0 && g.saved >= g.target), progress: Math.min(100, best) }
    }
  },
  {
    def: { id: 'saver-streak', emoji: '🔥', title: 'Economia em série', description: 'Gaste menos que o mês anterior por 3 meses seguidos.' },
    evaluate: c => {
      const s = savingStreak(c.transactions)
      return { unlocked: s >= 3, progress: Math.min(100, (s / 3) * 100) }
    }
  },
  {
    def: { id: 'under-budget', emoji: '🛡️', title: 'Dentro do plano', description: 'Feche o mês dentro do orçamento total.' },
    evaluate: c => {
      if (!c.hasBudget || c.budgetTotal <= 0) return { unlocked: false, progress: 0 }
      const spent = sumByType(c.transactions.filter(t => isSameMonth(t.date)), 'expense')
      const pct = (spent / c.budgetTotal) * 100
      return { unlocked: spent <= c.budgetTotal, progress: Math.min(100, 100 - Math.max(0, pct - 100)) }
    }
  },
  {
    def: { id: 'first-investment', emoji: '📈', title: 'Investidor iniciante', description: 'Adicione seu primeiro ativo à carteira.' },
    evaluate: c => ({ unlocked: c.portfolio.length >= 1, progress: c.portfolio.length >= 1 ? 100 : 0 })
  },
  {
    def: { id: 'diversified', emoji: '🧺', title: 'Diversificado', description: 'Tenha 3 ativos diferentes na carteira.' },
    evaluate: c => ({ unlocked: c.portfolio.length >= 3, progress: Math.min(100, (c.portfolio.length / 3) * 100) })
  },
  {
    def: { id: 'benefits-mapped', emoji: '🎁', title: 'Benefícios no radar', description: 'Cadastre um benefício que você recebe.' },
    evaluate: c => ({ unlocked: c.benefitsCount >= 1, progress: c.benefitsCount >= 1 ? 100 : 0 })
  }
]

export function computeAchievements(state: AppState): AchievementStatus[] {
  const income = sumByType(state.transactions.filter(t => isSameMonth(t.date)), 'income') + state.settings.mainIncome
  const ctx: AchievementContext = {
    transactions: state.transactions,
    goals: state.goals,
    portfolio: state.portfolio,
    monthlyIncome: income,
    benefitsCount: state.benefits.length,
    hasBudget: state.budgets.length > 0,
    budgetTotal: state.budgets.reduce((a, b) => a + b.limit, 0)
  }
  return DEFINITIONS.map(({ def, evaluate }) => {
    const { unlocked, progress } = evaluate(ctx)
    return { ...def, unlocked, progress: Math.round(progress) }
  })
}

// ---- Conquered savings -------------------------------------------------------

export interface ConqueredSavings {
  totalSaved: number
  goalsProgress: number
  portfolioProfit: number
  benefitsPerYear: number
}

/** A consolidated "what you've won" figure: money set aside in goals, gains in
 * the investment portfolio (given current quote prices) and the yearly value of
 * benefits received. `portfolioValue` is the caller-computed current value. */
export function computeConqueredSavings(state: AppState, portfolioValue: number): ConqueredSavings {
  const goalsProgress = state.goals.reduce((acc, g) => acc + Math.min(g.saved, g.target), 0)
  const invested = state.portfolio.reduce((acc, p) => acc + p.quantity * p.avgPrice, 0)
  const portfolioProfit = Math.max(0, portfolioValue - invested)
  const benefitsPerYear = summarizeBenefits(state.benefits).annualTotal
  return {
    totalSaved: goalsProgress + portfolioProfit,
    goalsProgress,
    portfolioProfit,
    benefitsPerYear
  }
}
