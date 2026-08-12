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
}

export interface AppState {
  settings: UserSettings
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  portfolio: PortfolioAsset[]
  recurringRules: RecurringRule[]
  demoDataCleared: boolean
  schemaVersion?: number
}
