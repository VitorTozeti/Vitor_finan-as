export type PaymentMethod = 'Pix' | 'Débito' | 'Crédito' | 'Dinheiro' | 'Outro'

export interface Category {
  id: string
  name: string
  icon: string
  custom?: boolean
}

export interface Transaction {
  id: string
  type: 'expense' | 'income'
  amount: number
  description: string
  categoryId: string
  date: string // ISO date
  paymentMethod?: PaymentMethod
  note?: string
  createdAt: string
  fitid?: string
  recurringRuleId?: string
}

export interface Budget {
  categoryId: string
  limit: number
}

export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  deadline?: string
}

export interface IncomeSource {
  id: string
  name: string
  amount: number
  payDay: number
}

export interface PortfolioAsset {
  id: string
  ticker: string
  quantity: number
  avgPrice: number
}

export interface RecurringRule {
  id: string
  description: string
  amount: number
  type: 'expense' | 'income'
  categoryId: string
  paymentMethod?: PaymentMethod
  dayOfMonth: number
  active: boolean
  lastGeneratedMonth?: string // yyyy-mm of the last month a transaction was generated for
}

export interface UserSettings {
  onboarded: boolean
  mainIncome: number
  payDay: number
  otherIncomeSources: IncomeSource[]
  monthlyBudgetTotal?: number
  mainGoalDescription?: string
  /** Visual theme id — see src/data/themes.ts. Defaults to 'verde-noturno'. */
  theme?: string
}

export type BenefitType = 'VA' | 'VR' | 'Transporte' | 'Saúde' | 'PLR' | 'Outro'
export type BenefitFrequency = 'mensal' | 'único' | 'anual'

/** An employer/other benefit the user receives (meal voucher, transport, health
 * plan, profit share, etc.). `currentBalance` tracks a reloadable card balance
 * (e.g. VA/VR); `resetDay` is the day of month the balance is topped up. */
export interface Benefit {
  id: string
  name: string
  type: BenefitType
  amount: number
  frequency: BenefitFrequency
  resetDay?: number
  currentBalance?: number
  note?: string
  /** Card operator / provider (Alelo, VR, Caju, Flash, Sodexo…). */
  provider?: string
}

export type CashbackUnit = 'R$' | 'pontos' | 'milhas'

export interface CashbackEntry {
  id: string
  amount: number
  date: string // ISO
  note?: string
}

/** A cashback / points / miles program tied to a card or store. */
export interface CashbackProgram {
  id: string
  name: string
  unit: CashbackUnit
  entries: CashbackEntry[]
}

/** Persisted record of which achievements the user has unlocked, so a badge
 * doesn't "re-unlock" (and re-notify) every load. Definitions/progress are
 * computed at runtime from transactions/goals/portfolio. */
export interface UnlockedAchievement {
  id: string
  unlockedAt: string // ISO
}

export interface AppState {
  settings: UserSettings
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  portfolio: PortfolioAsset[]
  recurringRules: RecurringRule[]
  benefits: Benefit[]
  cashbackPrograms: CashbackProgram[]
  unlockedAchievements: UnlockedAchievement[]
  demoDataCleared: boolean
  schemaVersion?: number
}
