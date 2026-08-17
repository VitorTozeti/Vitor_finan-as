import { Benefit, Category, Transaction, UserSettings } from '../types'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'alimentacao', name: 'Alimentação', icon: '🍔' },
  { id: 'transporte', name: 'Transporte', icon: '🚌' },
  { id: 'faculdade', name: 'Faculdade', icon: '🎓' },
  { id: 'casa', name: 'Casa', icon: '🏠' },
  { id: 'lazer', name: 'Lazer', icon: '🎮' },
  { id: 'jogos', name: 'Jogos', icon: '🕹️' },
  { id: 'assinaturas', name: 'Assinaturas', icon: '📱' },
  { id: 'saude', name: 'Saúde', icon: '💊' },
  { id: 'compras', name: 'Compras', icon: '🛍️' },
  { id: 'investimentos', name: 'Investimentos', icon: '📈' },
  { id: 'outros', name: 'Outros', icon: '📦' }
]

export const DEFAULT_SETTINGS: UserSettings = {
  onboarded: false,
  mainIncome: 1290,
  payDay: 5,
  otherIncomeSources: [],
  monthlyBudgetTotal: undefined,
  mainGoalDescription: undefined
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Example benefits shown alongside the demo data so the Benefits screen isn't
 * empty on first run. Cleared together with the rest of the demo dataset. */
export function DEMO_BENEFITS(): Benefit[] {
  return [
    { id: 'demo-benefit-va', name: 'Vale-alimentação', type: 'VA', amount: 600, frequency: 'mensal', resetDay: 1, currentBalance: 420 },
    { id: 'demo-benefit-vt', name: 'Vale-transporte', type: 'Transporte', amount: 220, frequency: 'mensal', resetDay: 1, currentBalance: 150 },
    { id: 'demo-benefit-saude', name: 'Plano de saúde', type: 'Saúde', amount: 380, frequency: 'mensal' }
  ]
}

export function buildDemoTransactions(): Transaction[] {
  const now = new Date().toISOString()
  return [
    { id: 'demo-1', type: 'expense', amount: 180, description: 'Mercado do mês', categoryId: 'alimentacao', date: isoDaysAgo(3), paymentMethod: 'Pix', createdAt: now },
    { id: 'demo-2', type: 'expense', amount: 100, description: 'Ônibus + app de transporte', categoryId: 'transporte', date: isoDaysAgo(5), paymentMethod: 'Débito', createdAt: now },
    { id: 'demo-3', type: 'expense', amount: 80, description: 'Saída com amigos', categoryId: 'lazer', date: isoDaysAgo(2), paymentMethod: 'Dinheiro', createdAt: now },
    { id: 'demo-4', type: 'expense', amount: 150, description: 'Material da faculdade', categoryId: 'faculdade', date: isoDaysAgo(10), paymentMethod: 'Crédito', createdAt: now },
    { id: 'demo-5', type: 'expense', amount: 40, description: 'Assinaturas de streaming', categoryId: 'assinaturas', date: isoDaysAgo(1), paymentMethod: 'Crédito', createdAt: now },
    { id: 'demo-6', type: 'income', amount: 1290, description: 'Salário', categoryId: 'outros', date: isoDaysAgo(15), paymentMethod: 'Pix', createdAt: now }
  ]
}
